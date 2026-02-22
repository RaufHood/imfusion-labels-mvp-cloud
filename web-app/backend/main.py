import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from imaging import manager
from annotation import annotation_manager

load_dotenv()

app = FastAPI(title="ImFusion Web Visualizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.environ.get("DICOM_PATH", "../../data/DICOMDIR")
UPLOAD_DIR = Path(tempfile.gettempdir()) / "imfusion_upload"

VALID_PLANES = {"axial", "sagittal", "coronal"}


def _find_load_path(base: Path) -> Path:
    """Return the best path inside *base* to hand to imf.load()."""
    # Prefer an explicit DICOMDIR file anywhere in the tree
    for p in sorted(base.rglob("DICOMDIR")):
        return p
    # Otherwise use the directory that contains the most .dcm files
    dcm_dirs: dict[Path, int] = {}
    for dcm in base.rglob("*.dcm"):
        dcm_dirs[dcm.parent] = dcm_dirs.get(dcm.parent, 0) + 1
    if dcm_dirs:
        return max(dcm_dirs, key=lambda p: dcm_dirs[p])
    # Last resort: the base itself
    return base


@app.on_event("startup")
def startup():
    if not Path(DATA_PATH).exists():
        print(f"Default DICOM path not found ({DATA_PATH}). Waiting for upload.")
        return
    print(f"Loading volume from: {DATA_PATH}")
    manager.load(DATA_PATH)
    info = manager.info()
    print(f"Loaded volume: shape={info['shape']}, spacing={info['spacing']}")
    print(f"  Default WW/WL: {info['ww']:.1f} / {info['wl']:.1f}")
    annotation_manager.init(tuple(info["shape"]))


@app.get("/api/info")
def get_info():
    if manager.arr is None:
        raise HTTPException(status_code=503, detail="No volume loaded yet. Please upload a DICOM dataset.")
    return manager.info()


@app.post("/api/upload")
async def upload_dicom(file: UploadFile = File(...)):
    # Wipe previous upload and create a clean temp dir
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)
    UPLOAD_DIR.mkdir(parents=True)

    filename = file.filename or "upload"
    dest = UPLOAD_DIR / filename

    # Stream to disk so we don't blow up memory on large series
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    if filename.lower().endswith(".zip"):
        extract_dir = UPLOAD_DIR / "extracted"
        extract_dir.mkdir()
        try:
            with zipfile.ZipFile(dest, "r") as zf:
                zf.extractall(extract_dir)
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=422, detail=f"Not a valid ZIP file: {exc}")
        dest.unlink()
        load_path = _find_load_path(extract_dir)
    else:
        load_path = dest

    try:
        manager.load(str(load_path))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to load DICOM data: {exc}")

    info = manager.info()
    annotation_manager.init(tuple(info["shape"]))
    return info


@app.get("/api/slice/{plane}/{index}")
def get_slice(
    plane: str,
    index: int,
    ww: float = Query(None),
    wl: float = Query(None),
):
    if plane not in VALID_PLANES:
        raise HTTPException(status_code=400, detail=f"Invalid plane: {plane!r}. Use axial, sagittal, or coronal.")

    info = manager.info()
    ww = ww if ww is not None else info["ww"]
    wl = wl if wl is not None else info["wl"]

    png = manager.slice_png(plane, index, ww, wl)
    return Response(content=png, media_type="image/png")


@app.get("/api/mip")
def get_mip(
    ww: float = Query(None),
    wl: float = Query(None),
):
    info = manager.info()
    # Use wider window for MIP to show more structure
    ww = ww if ww is not None else info["ww"] * 2
    wl = wl if wl is not None else info["wl"]

    png = manager.mip_png(ww, wl)
    return Response(content=png, media_type="image/png")


# ─── Annotation routes ───────────────────────────────────────────────────────
# NOTE: /export must be registered BEFORE /{plane}/{index} to avoid FastAPI
# treating "export" as the plane path parameter.

@app.get("/api/annotation/export")
def export_annotation():
    if annotation_manager.mask is None:
        raise HTTPException(status_code=503, detail="No volume loaded.")
    if manager.sis is None:
        raise HTTPException(status_code=503, detail="No volume loaded.")
    try:
        dcm_bytes = annotation_manager.export_dicom_seg(manager.sis)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")
    return Response(
        content=dcm_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=annotation.dcm"},
    )


@app.post("/api/annotation/{plane}/{index}")
async def post_annotation(
    plane: str,
    index: int,
    file: UploadFile = File(...),
    erase: bool = Query(False),  # accepted but ignored; frontend sends full state
):
    if plane not in VALID_PLANES:
        raise HTTPException(status_code=400, detail=f"Invalid plane: {plane!r}.")
    if annotation_manager.mask is None:
        raise HTTPException(status_code=503, detail="No volume loaded.")
    png_bytes = await file.read()
    annotation_manager.apply_slice_png(plane, index, png_bytes)
    return {"ok": True}


@app.get("/api/annotation/{plane}/{index}")
def get_annotation(plane: str, index: int, v: int = Query(0)):
    if plane not in VALID_PLANES:
        raise HTTPException(status_code=400, detail=f"Invalid plane: {plane!r}.")
    if annotation_manager.mask is None:
        raise HTTPException(status_code=503, detail="No volume loaded.")
    png = annotation_manager.get_overlay_png(plane, index)
    return Response(content=png, media_type="image/png")


@app.delete("/api/annotation")
def delete_annotation():
    annotation_manager.clear()
    return {"ok": True}


@app.get("/api/voxel/{z}/{y}/{x}")
def get_voxel(z: int, y: int, x: int):
    if manager.arr is None:
        raise HTTPException(status_code=503, detail="No volume loaded.")
    z = max(0, min(z, manager.arr.shape[0] - 1))
    y = max(0, min(y, manager.arr.shape[1] - 1))
    x = max(0, min(x, manager.arr.shape[2] - 1))
    return {"hu": float(manager.arr[z, y, x])}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve React SPA — only if the static dir was built into the image
from fastapi.staticfiles import StaticFiles

if os.path.isdir("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
