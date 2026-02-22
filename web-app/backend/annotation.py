import io
import tempfile
from pathlib import Path

import imfusion as imf
import numpy as np
from PIL import Image


class AnnotationManager:
    def __init__(self):
        self.mask: np.ndarray | None = None  # (Z, Y, X) uint8

    def init(self, shape: tuple):
        """Initialize mask to zeros. Called after every volume load."""
        self.mask = np.zeros(shape, dtype=np.uint8)

    def _extract_slice(self, plane: str, index: int) -> np.ndarray:
        """Extract a 2D slice from the mask."""
        if plane == "axial":
            return self.mask[index, :, :]   # (Y, X)
        elif plane == "sagittal":
            return self.mask[:, :, index]   # (Z, Y)
        elif plane == "coronal":
            return self.mask[:, index, :]   # (Z, X)
        else:
            raise ValueError(f"Unknown plane: {plane}")

    def _write_slice(self, plane: str, index: int, binary: np.ndarray):
        """Write a 2D binary mask into the 3D mask."""
        if plane == "axial":
            self.mask[index, :, :] = binary
        elif plane == "sagittal":
            self.mask[:, :, index] = binary
        elif plane == "coronal":
            self.mask[:, index, :] = binary
        else:
            raise ValueError(f"Unknown plane: {plane}")

    def apply_slice_png(self, plane: str, index: int, png_bytes: bytes):
        """Apply a PNG stroke to the mask (full-state replace)."""
        if self.mask is None:
            return

        # Decode PNG → RGBA
        img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")

        # Get target voxel dims (rows, cols) for this plane
        if plane == "axial":
            rows, cols = self.mask.shape[1], self.mask.shape[2]  # (Y, X)
        elif plane == "sagittal":
            rows, cols = self.mask.shape[0], self.mask.shape[1]  # (Z, Y)
        elif plane == "coronal":
            rows, cols = self.mask.shape[0], self.mask.shape[2]  # (Z, X)
        else:
            raise ValueError(f"Unknown plane: {plane}")

        # Resize to slice voxel dims (PIL takes width=cols, height=rows)
        img = img.resize((cols, rows), Image.NEAREST)
        arr = np.array(img)  # (rows, cols, 4)

        # Build binary mask from alpha channel
        alpha = arr[:, :, 3]
        binary = (alpha > 0).astype(np.uint8)

        # Flip vertically to reverse the display flip that imaging.py applies
        binary = np.flipud(binary)

        self._write_slice(plane, index, binary)

    def get_overlay_png(self, plane: str, index: int) -> bytes:
        """Return an RGBA PNG overlay for the given plane/index."""
        if self.mask is None:
            buf = io.BytesIO()
            Image.new("RGBA", (1, 1), (0, 0, 0, 0)).save(buf, format="PNG")
            return buf.getvalue()

        sl = self._extract_slice(plane, index).copy()
        # Apply flipud same as imaging.py so overlay aligns with CT image
        sl = np.flipud(sl)

        rows, cols = sl.shape
        rgba = np.zeros((rows, cols, 4), dtype=np.uint8)
        mask_bool = sl > 0
        rgba[mask_bool] = [255, 80, 80, 160]
        # background stays fully transparent

        img = Image.fromarray(rgba, mode="RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def clear(self):
        """Reset mask to zeros."""
        if self.mask is not None:
            self.mask[:] = 0

    def export_dicom_seg(self, sis) -> bytes:
        """Export the annotation mask as a DICOM SEG file."""
        mask_4d = self.mask[:, :, :, np.newaxis].astype(np.uint8)  # (Z,Y,X,1)
        mask_sis = imf.SharedImageSet(mask_4d)
        tmp = Path(tempfile.mktemp(suffix=".dcm"))
        imf.dicom.save_file(mask_sis, str(tmp), referenced_image=sis)
        data = tmp.read_bytes()
        tmp.unlink(missing_ok=True)
        return data


annotation_manager = AnnotationManager()
