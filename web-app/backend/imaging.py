import imfusion as imf
import numpy as np
from PIL import Image
import io


class ImageManager:
    def __init__(self):
        self.sis = None      # SharedImageSet
        self.arr = None      # numpy (Z, Y, X) float32
        self.spacing = None  # [sz, sy, sx] in mm
        self._ww_default = 400
        self._wl_default = 40

    def load(self, path: str):
        result = imf.load(path)
        self.sis = result[0]
        image = self.sis[0]  # first SharedImage
        raw = image.numpy()  # shape: (Z, Y, X) or (Z, Y, X, C)
        arr = np.squeeze(raw).astype(np.float32)
        # Ensure we have exactly 3 dims (Z, Y, X)
        if arr.ndim != 3:
            raise ValueError(f"Unexpected array shape after squeeze: {raw.shape}")
        self.arr = arr

        desc = image.descriptor
        spacing = list(desc.spacing)
        # spacing from descriptor is (sx, sy, sz) — reorder to (sz, sy, sx)
        if len(spacing) == 3:
            self.spacing = [spacing[2], spacing[1], spacing[0]]
        else:
            self.spacing = spacing

        # Auto-detect sensible window defaults from data range
        p5 = float(np.percentile(self.arr, 5))
        p95 = float(np.percentile(self.arr, 95))
        self._wl_default = (p5 + p95) / 2
        self._ww_default = max(p95 - p5, 1.0)

    def _apply_windowing(self, sl: np.ndarray, ww: float, wl: float) -> np.ndarray:
        lo = wl - ww / 2
        hi = wl + ww / 2
        sl = np.clip((sl - lo) / (hi - lo), 0, 1)
        return (sl * 255).astype(np.uint8)

    def _to_png(self, arr2d: np.ndarray) -> bytes:
        img = Image.fromarray(arr2d, mode="L")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def slice_png(self, plane: str, index: int, ww: float, wl: float) -> bytes:
        z, y, x = self.arr.shape
        if plane == "axial":
            index = max(0, min(index, z - 1))
            sl = self.arr[index, :, :]
        elif plane == "sagittal":
            index = max(0, min(index, x - 1))
            sl = self.arr[:, :, index]
        elif plane == "coronal":
            index = max(0, min(index, y - 1))
            sl = self.arr[:, index, :]
        else:
            raise ValueError(f"Unknown plane: {plane}")

        # Flip vertically so image appears right-side-up
        sl = np.flipud(sl)
        windowed = self._apply_windowing(sl, ww, wl)
        return self._to_png(windowed)

    def mip_png(self, ww: float, wl: float) -> bytes:
        # Coronal MIP: max along Y axis -> (Z, X)
        mip = self.arr.max(axis=1)
        mip = np.flipud(mip)
        windowed = self._apply_windowing(mip, ww, wl)
        return self._to_png(windowed)

    def info(self) -> dict:
        z, y, x = self.arr.shape
        return {
            "shape": [z, y, x],
            "spacing": self.spacing,
            "ww": self._ww_default,
            "wl": self._wl_default,
        }


manager = ImageManager()
