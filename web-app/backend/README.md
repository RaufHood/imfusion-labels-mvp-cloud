# Backend — ImFusion Web Visualizer

FastAPI-based REST backend that uses the **ImFusion Python SDK** to load DICOM datasets,
render 2D slice images, compute Maximum Intensity Projections, manage a voxel-space
annotation mask, and export DICOM Segmentation Objects.

---

## Table of contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Environment variables](#environment-variables)
5. [Running the server](#running-the-server)
6. [API reference](#api-reference)
7. [Module descriptions](#module-descriptions)

---

## Architecture

```
main.py          ← FastAPI application, route definitions, startup hook
imaging.py       ← ImageManager: DICOM loading, windowing, slice/MIP rendering
annotation.py    ← AnnotationManager: 3-D mask storage, overlay PNG, DICOM SEG export
```

On startup the server attempts to load a DICOM volume from `DICOM_PATH`. If the path does
not exist the server starts normally and waits for a dataset to be uploaded via
`POST /api/upload`.

All image data is held in memory as a NumPy array `(Z, Y, X) float32`.
The annotation mask is a NumPy array `(Z, Y, X) uint8` initialised to zeros when a volume
is loaded and reset on every subsequent upload.

In production the built React SPA is served as static files by FastAPI from the `./static/`
directory.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11 |
| ImFusion SDK wheel | `imfusion_sdk-0.10.0+webshop.free` (Linux x86-64) |
| Valid license key | `IMFUSION_LICENSE_KEY` env variable |

> **Note**: The ImFusion SDK wheel is only available for **Linux x86-64**. The backend
> cannot run natively on Windows or macOS; use Docker for those environments.

---

## Setup

```bash
cd web-app/backend

# Create and activate a virtual environment (recommended)
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies (the wheel is fetched directly from the ImFusion download server)
pip install -r requirements.txt
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `IMFUSION_LICENSE_KEY` | *(required)* | License key for the ImFusion SDK. Must be set **before** the process starts. |
| `DICOM_PATH` | `../../data/DICOMDIR` | Path to a DICOMDIR file or a directory containing DICOM files. Loaded automatically on startup. |

Create a `.env` file in `web-app/backend/` (or in the project root) — `python-dotenv` loads
it before `imfusion` is imported:

```dotenv
IMFUSION_LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
DICOM_PATH=../../data/DICOMDIR
```

---

## Running the server

```bash
# Development (auto-reload on file changes)
uvicorn main:app --reload --port 8000

# Production (multi-worker)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

> Use a **single worker** (`--workers 1`). The volume is stored as a module-level singleton;
> multiple workers would each hold independent copies and annotation state would diverge.

Verify the server is healthy:

```
GET http://localhost:8000/api/health
→ {"status": "ok"}
```

---

## API reference

All endpoints are prefixed with `/api`.

---

### `GET /api/health`

Liveness probe. Always returns `200 OK` if the process is running.

**Response**

```json
{"status": "ok"}
```

---

### `GET /api/info`

Returns metadata about the currently loaded volume.

**Response** `200 OK`

```json
{
  "shape":   [512, 512, 300],
  "spacing": [1.0, 0.742, 0.742],
  "ww":      1500.0,
  "wl":      -600.0
}
```

| Field | Type | Description |
|---|---|---|
| `shape` | `[Z, Y, X]` | Volume dimensions in voxels |
| `spacing` | `[sz, sy, sx]` | Voxel spacing in millimetres |
| `ww` | `float` | Recommended window width (auto-detected from data) |
| `wl` | `float` | Recommended window level / centre (auto-detected from data) |

**Errors**

| Status | Condition |
|---|---|
| `503` | No volume has been loaded yet |

---

### `POST /api/upload`

Upload a DICOM dataset to replace the currently loaded volume. Accepts a single file
(`multipart/form-data`).

**Accepted formats**

- `.zip` — a ZIP archive containing a DICOM folder. The server automatically locates the
  best load path inside the archive: a `DICOMDIR` file takes priority, otherwise the
  directory with the highest number of `.dcm` files is used.
- `DICOMDIR` — a bare DICOMDIR index file (the sibling DICOM files must be included in
  the same archive).

**Request**

```
Content-Type: multipart/form-data

file=<binary>
```

**Response** `200 OK` — same schema as `GET /api/info`

**Errors**

| Status | Condition |
|---|---|
| `422` | File is not a valid ZIP, or the DICOM data cannot be read |

---

### `GET /api/slice/{plane}/{index}`

Render a single 2-D slice as a grayscale PNG image with optional windowing applied.

**Path parameters**

| Parameter | Values | Description |
|---|---|---|
| `plane` | `axial` \| `sagittal` \| `coronal` | Anatomical plane to slice along |
| `index` | integer ≥ 0 | Zero-based slice index along the plane's primary axis |

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ww` | `float` | volume default | Window width |
| `wl` | `float` | volume default | Window level (centre) |

**Response** `200 OK` — `Content-Type: image/png`

A grayscale PNG image. Dimensions match the voxel extent of the requested plane:

| Plane | PNG dimensions |
|---|---|
| Axial | X × Y |
| Sagittal | Y × Z |
| Coronal | X × Z |

**Errors**

| Status | Condition |
|---|---|
| `400` | `plane` is not one of the three valid values |
| `503` | No volume loaded |

---

### `GET /api/mip`

Compute a coronal **Maximum Intensity Projection** and return it as a grayscale PNG.
The projection is taken along the Y axis (anterior–posterior), producing a `(Z, X)` image.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ww` | `float` | `volume_ww × 2` | Window width (defaults to twice the per-slice default to reveal more structure) |
| `wl` | `float` | volume default | Window level |

**Response** `200 OK` — `Content-Type: image/png`

**Errors**

| Status | Condition |
|---|---|
| `503` | No volume loaded |

---

### `GET /api/annotation/{plane}/{index}`

Return the annotation overlay for a given slice as a semi-transparent RGBA PNG
(red channel, α = 160 where annotated, fully transparent elsewhere).

**Path parameters** — same as `GET /api/slice`

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `v` | `int` | Cache-busting version token; increment to force browser refresh |

**Response** `200 OK` — `Content-Type: image/png` (RGBA)

**Errors**

| Status | Condition |
|---|---|
| `400` | Invalid plane |
| `503` | No volume loaded |

---

### `POST /api/annotation/{plane}/{index}`

Apply a brush stroke to the annotation mask.

The request body is a **full-state PNG canvas snapshot** (RGBA). The server decodes the
PNG, resizes it to the slice's voxel dimensions, and replaces the stored mask slice.
Any pixel with `alpha > 0` is treated as annotated.

**Path parameters** — same as `GET /api/slice`

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `erase` | `bool` | `false` | Accepted for protocol symmetry; ignored — erase state is encoded in the canvas PNG sent by the client |

**Request** `multipart/form-data` — field `file` containing a PNG blob

**Response** `200 OK`

```json
{"ok": true}
```

**Errors**

| Status | Condition |
|---|---|
| `400` | Invalid plane |
| `503` | No volume loaded |

---

### `GET /api/annotation/export`

Export the complete 3-D annotation mask as a **DICOM Segmentation Object** (`.dcm`).
The file is generated using `imf.dicom.save_file` with the loaded volume as the reference
image set, ensuring correct patient/study metadata and spatial alignment.

**Response** `200 OK`

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename=annotation.dcm
```

**Errors**

| Status | Condition |
|---|---|
| `500` | DICOM SEG generation failed (details in `detail` field) |
| `503` | No volume loaded |

---

### `DELETE /api/annotation`

Reset the annotation mask to all zeros (clear all annotations).

**Response** `200 OK`

```json
{"ok": true}
```

---

### `GET /api/voxel/{z}/{y}/{x}`

Look up the raw voxel intensity at a given position in the loaded volume.
The coordinates are clamped to valid bounds automatically.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `z` | `int` | Axial index (0 = bottom of the volume as loaded) |
| `y` | `int` | Coronal index |
| `x` | `int` | Sagittal index |

**Response** `200 OK`

```json
{"hu": -512.0}
```

The `hu` value is the raw floating-point voxel intensity. For CT data this corresponds
to Hounsfield Units; for other modalities the unit depends on the series.

**Errors**

| Status | Condition |
|---|---|
| `503` | No volume loaded |

---

## Module descriptions

### `main.py`

Application entry point. Responsibilities:

- Registers FastAPI middleware (CORS — allow-all for local development)
- Defines the startup hook that pre-loads the default DICOM path
- Declares all HTTP routes and delegates business logic to `imaging.manager`
  and `annotation.annotation_manager`
- Mounts the built React SPA from `./static/` when the directory is present
  (production Docker image)

### `imaging.py` — `ImageManager`

Wraps the ImFusion SDK for DICOM I/O and image rendering.

| Method | Description |
|---|---|
| `load(path)` | Load a DICOM volume via `imf.load()`. Stores the raw NumPy array `(Z, Y, X)` and voxel spacing. Auto-detects WW/WL from the 5th and 95th percentiles of the data. |
| `slice_png(plane, index, ww, wl)` | Extract and window a 2-D slice; return as a grayscale PNG `bytes`. Images are flipped vertically so the rendered orientation matches standard radiological convention. |
| `mip_png(ww, wl)` | Compute a coronal MIP (`arr.max(axis=1)`) and return a windowed PNG. |
| `info()` | Return `shape`, `spacing`, `ww`, and `wl` as a dict. |

### `annotation.py` — `AnnotationManager`

Maintains a voxel-space annotation mask and provides PNG-based serialisation.

| Method | Description |
|---|---|
| `init(shape)` | Allocate a zero-filled `uint8` mask matching the volume shape. |
| `apply_slice_png(plane, index, png_bytes)` | Decode a client-sent RGBA PNG, resize to the slice's voxel dimensions, and write the resulting binary mask into the 3-D volume. The vertical flip applied in `imaging.py` is reversed here to maintain spatial consistency. |
| `get_overlay_png(plane, index)` | Extract a mask slice, apply the same vertical flip used for CT images, and encode as a semi-transparent RGBA PNG ready to composite over the slice image. |
| `clear()` | Zero-fill the entire mask in place. |
| `export_dicom_seg(sis)` | Wrap the mask in an `imf.SharedImageSet`, call `imf.dicom.save_file` with the source image set as reference, and return the file bytes. The temporary `.dcm` file is deleted after reading. |
