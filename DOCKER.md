# Docker Deployment Guide — ImFusion Web Visualizer

This guide covers building, configuring, and running the ImFusion Web Visualizer as a
self-contained Docker container, as well as deploying it to [Fly.io](https://fly.io).

---

## Table of contents

1. [Image overview](#image-overview)
2. [Prerequisites](#prerequisites)
3. [Build](#build)
4. [Run](#run)
5. [Environment variables](#environment-variables)
6. [License fingerprint locking](#license-fingerprint-locking)
7. [Health check](#health-check)
8. [Fly.io deployment](#flyio-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Image overview

The `Dockerfile` at the repository root uses a **multi-stage build**:

| Stage | Base image | Purpose |
|---|---|---|
| `frontend-builder` | `node:20-slim` | Install Node dependencies, run `npm run build`, produce the React SPA in `dist/` |
| *(final)* | `python:3.11-slim` | Install Python dependencies including the ImFusion SDK, copy the built frontend into `./static/`, start the application |

The final image runs a **single process**: Uvicorn serves both the FastAPI REST API and
the pre-built React SPA as static files. No separate web server is needed.

### OpenGL / headless display

The ImFusion SDK requires an OpenGL context even for CPU-only DICOM I/O. The image
provides this without a GPU via:

- **Mesa software renderer** (`libegl-mesa0`, `libglx-mesa0`) — a pure-software OpenGL
  implementation.
- **Xvfb** — a virtual X11 display that Mesa can connect to.
- `LIBGL_ALWAYS_SOFTWARE=1` — forces Mesa to use the software rasteriser.
- `DISPLAY=:99` — points the ImFusion SDK to the Xvfb display.

The startup command launches Xvfb in the background, waits one second for it to
initialise, then starts Uvicorn.

---

## Prerequisites

- Docker Engine 20.10 or later
- A valid **ImFusion SDK license key** (`IMFUSION_LICENSE_KEY`)

---

## Build

```bash
# From the repository root (where the Dockerfile lives)
docker build -t imfusion-app .
```

The build step fetches the ImFusion SDK wheel from the ImFusion download server. Ensure
the build host has internet access, or pre-cache the wheel in the image layer.

---

## Run

```bash
docker run \
  --hostname imfusion-server \
  --mac-address 02:42:ac:11:00:02 \
  -e IMFUSION_LICENSE_KEY="XXXX-XXXX-XXXX-XXXX" \
  -p 8080:8080 \
  imfusion-app
```

The application is then available at `http://localhost:8080`.

The `--hostname` and `--mac-address` flags are required for license fingerprint stability —
see [License fingerprint locking](#license-fingerprint-locking) for an explanation.

### Loading a local DICOM dataset

Mount a DICOM directory and point the `DICOM_PATH` variable to it:

```bash
docker run \
  --hostname imfusion-server \
  --mac-address 02:42:ac:11:00:02 \
  -e IMFUSION_LICENSE_KEY="XXXX-XXXX-XXXX-XXXX" \
  -e DICOM_PATH="/data/DICOMDIR" \
  -v /path/to/your/dicom:/data:ro \
  -p 8080:8080 \
  imfusion-app
```

If `DICOM_PATH` is not set or the path does not exist, the server starts without a
pre-loaded volume and waits for a dataset to be uploaded through the UI.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `IMFUSION_LICENSE_KEY` | **Yes** | — | ImFusion SDK license key |
| `DICOM_PATH` | No | `../../data/DICOMDIR` | Path to a DICOMDIR file or DICOM directory to load on startup |

---

## License fingerprint locking

The ImFusion SDK uses a hardware fingerprint (hostname + MAC address + `/etc/machine-id`)
to track license activations. Each unique fingerprint consumes one activation slot on the
license server.

A standard Docker container generates a new hostname and MAC address on every run, which
means every container launch would be seen as a new machine and deplete the license
pool.

This image addresses the issue with two measures:

### 1 — Fixed `/etc/machine-id` baked into the image

The Dockerfile writes a stable, deterministic value to `/etc/machine-id`:

```dockerfile
RUN echo "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" > /etc/machine-id
```

This ensures the machine-id component of the fingerprint is identical across all
containers built from this image.

### 2 — Fixed hostname and MAC address at runtime

The remaining two fingerprint components (hostname and MAC address) are pinned at
runtime using Docker flags:

```
--hostname imfusion-server
--mac-address 02:42:ac:11:00:02
```

With all three components stable, the fingerprint never changes across container restarts
or re-deployments, and only **one activation slot** is consumed for the lifetime of
the image.

> **Important**: always include both flags when running the container. Omitting them
> will produce a different fingerprint and may exhaust license activations.

---

## Health check

The application exposes a liveness endpoint at `GET /api/health` that returns
`{"status": "ok"}` with HTTP 200 as long as the process is running.

This endpoint is used by the Fly.io health-check configuration (see `fly.toml`) and can
be used with any container orchestration health probe.

---

## Fly.io deployment

The repository includes a `fly.toml` configuration for deploying to [Fly.io](https://fly.io).

### Configuration summary

```toml
app            = "imfusion-app"
primary_region = "fra"          # Frankfurt — change to suit your users

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port       = 8080
  force_https         = true
  auto_stop_machines  = true    # Machine sleeps when idle (scale-to-zero)
  auto_start_machines = true    # Wakes on incoming request
  min_machines_running = 0

  [[http_service.checks]]
    path         = "/api/health"
    interval     = "30s"
    timeout      = "5s"
    grace_period = "30s"

[[vm]]
  memory   = "1gb"
  cpu_kind = "shared"
  cpus     = 1
```

### Deploying

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and authenticate:

   ```bash
   flyctl auth login
   ```

2. Set the license key as a secret (never commit it to source control):

   ```bash
   flyctl secrets set IMFUSION_LICENSE_KEY="XXXX-XXXX-XXXX-XXXX"
   ```

3. Deploy:

   ```bash
   flyctl deploy
   ```

> **Note on fingerprinting with Fly.io**: Fly.io assigns stable internal hostnames and
> network interfaces to machines when using persistent volumes. The fixed `machine-id` in
> the image is sufficient; the `--hostname` and `--mac-address` Docker flags are not
> applicable in the Fly.io runtime. If you observe license activation errors after
> re-deployment, contact [support@imfusion.com](mailto:support@imfusion.com) to request a
> server/floating license designed for containerised deployments.

---

## Troubleshooting

### `RuntimeError: imf.load() is missing` on startup

The ImFusion SDK did not initialise fully. Possible causes:

- `IMFUSION_LICENSE_KEY` is not set or contains extra whitespace. Verify the variable
  is present and correctly formatted:
  ```bash
  docker run --rm imfusion-app env | grep IMFUSION
  ```
- The license key has no remaining activations. Check the
  [ImFusion webshop](https://shop.imfusion.com) dashboard.
- The container was started without the fixed hostname / MAC address, producing a new
  fingerprint that consumed another activation slot.

### OpenGL / EGL errors in logs

Lines such as `libEGL warning: MESA-LOADER: ...` or `failed to open /dev/dri/...` are
expected when running without a GPU. The Mesa software renderer will be used
automatically. As long as the application starts correctly these warnings can be ignored.

### Import smoke test

To verify that the ImFusion SDK imports correctly without starting the full application:

```bash
docker run --rm \
  --hostname imfusion-server \
  --mac-address 02:42:ac:11:00:02 \
  -e IMFUSION_LICENSE_KEY="XXXX-XXXX-XXXX-XXXX" \
  --entrypoint python \
  imfusion-app \
  -c "from imaging import manager; print('OK')"
```

Expected output: `OK` (possibly preceded by Mesa/GL warning lines).

### Container exits immediately

Check the container logs:

```bash
docker logs <container-id>
```

Common causes: missing `IMFUSION_LICENSE_KEY`, Xvfb failing to start (rare on
standard Linux kernels), or a port conflict on 8080.

### Port conflict

Change the host port mapping:

```bash
docker run ... -p 9090:8080 imfusion-app
```

The container always listens on port 8080 internally; only the host-side port changes.
