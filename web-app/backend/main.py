import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from imaging import manager

load_dotenv()

app = FastAPI(title="ImFusion Web Visualizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.environ.get("DICOM_PATH", "../../data/DICOMDIR")

VALID_PLANES = {"axial", "sagittal", "coronal"}


@app.on_event("startup")
def startup():
    print(f"Loading volume from: {DATA_PATH}")
    manager.load(DATA_PATH)
    info = manager.info()
    print(f"Loaded volume: shape={info['shape']}, spacing={info['spacing']}")
    print(f"  Default WW/WL: {info['ww']:.1f} / {info['wl']:.1f}")


@app.get("/api/info")
def get_info():
    return manager.info()


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
