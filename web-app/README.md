# ImFusion Web Visualizer

4-panel MPR viewer (axial / sagittal / coronal / 3D MIP) in the browser, powered by the ImFusion Python SDK.

## Quick Start

### Backend

```bash
cd web-app/backend

# Install dependencies (into the same env that has imfusion-sdk)
pip install -r requirements.txt

# Set DICOM path (defaults to ../../data/DICOMDIR)
export DICOM_PATH=../../data/DICOMDIR

# Start server
uvicorn main:app --reload --port 8000
```

Verify: http://localhost:8000/api/info — should return volume shape/spacing.

### Frontend

```bash
cd web-app/frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Controls

- **Scroll wheel** in any 2D panel: navigate through slices on that axis
- **Click** in any 2D panel: move crosshairs (synced across all panels)
- **WW / WL sliders** in the toolbar: adjust window width and level

## API Endpoints

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/api/info` | — | `{shape, spacing, ww, wl}` |
| GET | `/api/slice/{plane}/{index}` | `ww`, `wl` | PNG image |
| GET | `/api/mip` | `ww`, `wl` | PNG image (coronal MIP) |

`plane` ∈ `axial` \| `sagittal` \| `coronal`
