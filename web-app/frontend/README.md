# Frontend — ImFusion Web Visualizer

React + TypeScript single-page application that renders a 4-panel MPR viewer in the
browser, communicating with the FastAPI backend over a REST API.

---

## Table of contents

1. [Technology stack](#technology-stack)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Development](#development)
5. [Production build](#production-build)
6. [Project structure](#project-structure)
7. [State management](#state-management)
8. [API layer](#api-layer)
9. [Component reference](#component-reference)

---

## Technology stack

| Library | Version | Role |
|---|---|---|
| React | 18 | UI rendering |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool and dev server |
| Zustand | 4 | Global client state |

No CSS framework or component library is used. All styles are inline React `style` props,
which keeps the bundle small and avoids external theming conflicts.

---

## Prerequisites

- **Node.js** 18 or later (Node 20 recommended)
- **npm** 9 or later (bundled with Node.js)
- The **backend** must be running on `http://localhost:8000` during development

---

## Setup

```bash
cd web-app/frontend
npm install
```

---

## Development

```bash
npm run dev
```

Starts a Vite dev server at `http://localhost:5173`.

All requests to `/api/*` are automatically proxied to `http://localhost:8000` by the Vite
configuration in `vite.config.ts`. No CORS configuration or manual URL switching is
required.

---

## Production build

```bash
npm run build
```

Compiles TypeScript and bundles the application into `dist/`. The FastAPI backend in the
Docker image copies this directory to `./static/` and serves it as a static site, so the
SPA and the API share the same origin.

```bash
# Preview the production build locally
npm run preview
```

---

## Project structure

```
src/
├── main.tsx               # React entry point, mounts <App />
├── App.tsx                # Root component — manages the top-level load state
├── store.ts               # Zustand store — single source of truth for viewer state
├── api.ts                 # Typed fetch helpers for every backend endpoint
└── components/
    ├── MPRViewer.tsx       # Main viewer layout: toolbar + 2×2 panel grid
    ├── SlicePanel.tsx      # Reusable interactive 2-D slice panel
    ├── AnnotationCanvas.tsx # Drawing canvas overlay (sits on top of SlicePanel)
    ├── VolumePanel.tsx     # 3-D / MIP panel (bottom-right quadrant)
    └── UploadZone.tsx      # Full-screen drag-and-drop upload modal
```

---

## State management

All shared viewer state lives in a single **Zustand** store (`src/store.ts`).
Components subscribe to only the slices of state they need, preventing unnecessary
re-renders.

### Store shape

```ts
interface ViewerState {
  // Volume dimensions [Z, Y, X]
  shape: [number, number, number];

  // Current voxel cursor [z, y, x]
  // Determines which slice is displayed in each panel and where the crosshairs appear
  pos: [number, number, number];

  // Window width and window level
  ww: number;
  wl: number;

  // Annotation tool
  annotationMode: boolean;   // whether the brush tool is active
  brushSize: number;         // brush diameter in canvas pixels
  isErasing: boolean;        // erase mode when true, draw mode when false
  annotationVersion: number; // incremented after each "clear all" to force overlay refresh
}
```

### State transitions

| Event | State change |
|---|---|
| Volume loaded / uploaded | `shape` set to `[Z, Y, X]`; `pos` centred on volume; `ww`/`wl` set from API response |
| Scroll wheel in a slice panel | `pos[scrollAxis]` ± 1 |
| Click in a slice panel | `pos` updated to the clicked voxel coordinates |
| WW/WL slider drag | `ww` / `wl` updated; all panels re-fetch their slice images |
| Annotation stroke committed | `annotationVersion` incremented via `bumpAnnotationVersion()` |
| "Clear All" | `annotationVersion` incremented; backend mask zeroed via `DELETE /api/annotation` |

---

## API layer

`src/api.ts` contains all communication with the backend. Every function is typed and
throws a descriptive `Error` on non-2xx responses so that call sites can surface errors
without inspecting HTTP status codes directly.

### Functions

| Export | HTTP | Description |
|---|---|---|
| `fetchInfo()` | `GET /api/info` | Returns `VolumeInfo` (`shape`, `spacing`, `ww`, `wl`) |
| `sliceUrl(plane, index, ww, wl)` | — | Builds the URL string for a slice `<img>` tag |
| `mipUrl(ww, wl)` | — | Builds the URL string for the MIP `<img>` tag |
| `uploadDicom(file, signal?)` | `POST /api/upload` | Uploads a file and returns `VolumeInfo` |
| `annotationOverlayUrl(plane, index, version)` | — | Builds the URL for the annotation overlay `<img>` |
| `postAnnotationStroke(plane, index, blob)` | `POST /api/annotation/{plane}/{index}` | Sends the current canvas state to the backend |
| `exportDicomSeg()` | `GET /api/annotation/export` | Downloads the DICOM SEG as a `Blob` |
| `clearAnnotations()` | `DELETE /api/annotation` | Clears the server-side annotation mask |
| `getVoxelHU(z, y, x, signal?)` | `GET /api/voxel/{z}/{y}/{x}` | Returns the HU value at a voxel |

### URL helpers vs. async functions

Slice and overlay images are rendered as `<img src=...>` elements rather than fetched
as blobs. The URL-builder helpers (`sliceUrl`, `mipUrl`, `annotationOverlayUrl`) are
therefore synchronous — they construct the URL string and let the browser's image cache
manage the request lifecycle.

---

## Component reference

### `App.tsx`

Root component. Implements a simple load-state machine:

| State | Renders |
|---|---|
| `loading` | Spinner while `GET /api/info` is in-flight |
| `upload-first` | `<UploadZone open={true}>` when the backend has no volume loaded (HTTP 503) |
| `error` | Error message with backend connection instructions |
| `ready` | `<MPRViewer />` |

### `MPRViewer.tsx`

Top-level viewer layout. Contains:

- **Toolbar** — WW/WL sliders, Annotate toggle, Brush/Erase/Clear All controls (visible
  in annotation mode), Export SEG button, and Upload DICOM button.
- **2×2 grid** — `<SlicePanel plane="axial" />`, `<SlicePanel plane="sagittal" />`,
  `<SlicePanel plane="coronal" />`, and `<VolumePanel />`.

The toolbar reads and writes `ww`, `wl`, `annotationMode`, `brushSize`, and `isErasing`
from the Zustand store. All four panels update automatically when these values change.

### `SlicePanel.tsx`

Reusable panel for one anatomical plane. Configured via a `PANEL_CONFIGS` record that maps
each plane to its scroll axis, crosshair colour, badge label, and the two `pos` indices
that drive the horizontal and vertical crosshair positions.

**Interaction**

| Input | Behaviour |
|---|---|
| Wheel (annotation mode OFF) | Navigate ± 1 slice along `scrollAxis` |
| Click (annotation mode OFF) | Update `pos` to the clicked voxel; crosshairs in all other panels move accordingly |
| Mouse move | Fetch HU value at the hovered voxel via `GET /api/voxel/{z}/{y}/{x}` (debounced with `AbortController`) |

The slice image is an `<img>` element whose `src` is rebuilt from `sliceUrl(...)` whenever
`sliceIndex`, `ww`, or `wl` changes. A `key` change forces React to re-mount the element
and discard any cached frame, preventing stale image flashes.

`<AnnotationCanvas>` is mounted inside the panel and positioned precisely over the image
content area (excluding letterbox bars) using `ResizeObserver`.

### `AnnotationCanvas.tsx`

An `<canvas>` element that overlays the slice image. It is transparent and non-interactive
when annotation mode is off, becoming fully interactive when it is on.

**Rendering pipeline**

1. On each slice/plane/version change, the canvas loads the current server-side overlay
   from `GET /api/annotation/{plane}/{index}` and draws it using `ctx.drawImage`.
2. While the user draws, `paintAt(x, y)` renders brush circles directly onto the canvas
   using `ctx.arc`. Consecutive mouse-move events are interpolated to avoid gaps in the
   stroke.
3. On mouse-up or mouse-leave, `flushStroke()` encodes the entire canvas as a PNG blob
   and posts it to `POST /api/annotation/{plane}/{index}`. The backend replaces the
   stored mask slice with the decoded content.

The erase tool uses `globalCompositeOperation = "destination-out"` so that erased pixels
become transparent in the canvas PNG, which the backend interprets as unannotated voxels.

### `VolumePanel.tsx`

A simple display panel showing the coronal MIP image from `GET /api/mip`.
The window width is doubled relative to the per-slice default to provide a wider intensity
range and reveal more structural detail in the projection. Re-fetches whenever `ww` or `wl`
changes.

### `UploadZone.tsx`

A modal dialog for uploading DICOM data. It can be opened by:

- The **Upload DICOM** toolbar button (controlled by `uploadOpen` state in `MPRViewer`).
- Dragging any file over the browser window — detected via `window` `dragenter` / `dragleave`
  events with an entry counter to handle nested drag events correctly.

Supports `AbortController`-based cancellation: clicking **Cancel** during upload aborts the
`fetch` request and returns the modal to idle state without showing an error.

After a successful upload, `onSuccess(info)` is called with the new `VolumeInfo`, which
updates `shape` and `ww`/`wl` in the Zustand store and re-renders all four panels
with the new dataset.
