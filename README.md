# ImFusion Web Visualizer

A browser-based **4-panel Multi-Planar Reconstruction (MPR) viewer** for CT and DICOM datasets,
built on the [ImFusion Python SDK](https://imfusion.com/sdk).

---

## What it does

| Feature | Description |
|---|---|
| **MPR viewer** | Synchronized axial, sagittal, and coronal slice panels with interactive crosshairs |
| **3D / MIP panel** | Coronal Maximum Intensity Projection for a quick volumetric overview |
| **DICOM upload** | Drag-and-drop a ZIP archive or DICOMDIR file to load any CT series at runtime |
| **Window/Level** | Interactive WW/WL sliders with auto-detected defaults from data percentiles |
| **Voxel inspector** | Live HU (Hounsfield Unit) readout on mouse hover in any slice panel |
| **Annotation tool** | Paint brush annotations on any slice plane; erase and clear support |
| **DICOM SEG export** | Download the annotation mask as a standards-compliant DICOM Segmentation Object |

---

## Repository layout

```
web-app/
├── backend/          # FastAPI Python backend (DICOM processing + REST API)
│   ├── main.py       # Application entry point, all route definitions
│   ├── imaging.py    # DICOM loading and image rendering (ImFusion SDK)
│   ├── annotation.py # Annotation mask management and DICOM SEG export
│   └── requirements.txt
├── frontend/         # React + TypeScript + Vite single-page application
│   ├── src/
│   │   ├── App.tsx              # Root component and load-state machine
│   │   ├── store.ts             # Global state (Zustand)
│   │   ├── api.ts               # Typed fetch wrappers for the backend API
│   │   └── components/
│   │       ├── MPRViewer.tsx    # Main layout: toolbar + 2×2 panel grid
│   │       ├── SlicePanel.tsx   # Interactive 2D slice panel
│   │       ├── AnnotationCanvas.tsx  # Drawing canvas overlay
│   │       ├── VolumePanel.tsx  # 3D / MIP panel
│   │       └── UploadZone.tsx   # Drag-and-drop upload modal
│   ├── package.json
│   └── vite.config.ts
└── README.md         # This file
```

---

## Quick start (local development)

### 1 — Backend

See [`backend/README.md`](backend/README.md) for full details.

```bash
cd web-app/backend

# Requires Python 3.11 and a valid IMFUSION_LICENSE_KEY
pip install -r requirements.txt

export IMFUSION_LICENSE_KEY="your-key-here"
export DICOM_PATH="../../data/DICOMDIR"   # optional; upload via UI if omitted

uvicorn main:app --reload --port 8000
```

Verify: `http://localhost:8000/api/info`

### 2 — Frontend

See [`frontend/README.md`](frontend/README.md) for full details.

```bash
cd web-app/frontend
npm install
npm run dev
```

Open `http://localhost:5173` — API calls are automatically proxied to the backend on port 8000.

---

## Docker deployment

See [`../../DOCKER.md`](../../DOCKER.md) for the full containerised deployment guide, including
license fingerprint locking, Fly.io deployment, and troubleshooting.

```bash
# Build
docker build -t imfusion-app .

# Run
docker run \
  --hostname imfusion-server \
  --mac-address 02:42:ac:11:00:02 \
  -e IMFUSION_LICENSE_KEY="your-key-here" \
  -p 8080:8080 \
  imfusion-app
```

---

## UI controls

| Action | Gesture |
|---|---|
| Navigate slices | Scroll wheel inside any 2D panel |
| Move crosshairs (synced across panels) | Click inside any 2D panel |
| Adjust window width / level | WW / WL sliders in the toolbar |
| Toggle annotation brush | **Annotate** button in toolbar |
| Resize brush | Brush slider (visible in annotation mode) |
| Toggle eraser | **Erase** button (visible in annotation mode) |
| Clear all annotations | **Clear All** button (visible in annotation mode) |
| Export annotation as DICOM SEG | **Export SEG** button in toolbar |
| Load new dataset | **Upload DICOM** button (or drag a file anywhere onto the window) |
