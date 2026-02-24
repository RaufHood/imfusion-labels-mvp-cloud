# ── Stage 0: Compile fingerprint shim ───────────────────────────────────────
FROM debian:12-slim AS shim-builder
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*
COPY fingerprint_shim.c /tmp/fingerprint_shim.c
RUN gcc -shared -fPIC -o /fingerprint_shim.so /tmp/fingerprint_shim.c -ldl

# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY web-app/frontend/package*.json ./
RUN npm install
COPY web-app/frontend/ ./
RUN npm run build

# ── Stage 2: Python backend ─────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Runtime libs for imfusion-sdk: OpenMP, OpenGL/EGL, GLib
# Mesa software renderer + Xvfb virtual display so bind() can create an OpenGL context without a GPU
RUN apt-get update && apt-get install -y \
    libgomp1 libgl1 libegl1 libglib2.0-0 libgpg-error0 libp11-kit0 libcom-err2 \
    libegl-mesa0 libglx-mesa0 libgles2 xvfb \
    && rm -rf /var/lib/apt/lists/*

# Fixed fingerprint for LicenseSpring — all three inputs are now baked in:
#   machine-id  → /etc/machine-id (fixed at build time)
#   hostname    → intercepted by fingerprint_shim.so via LD_PRELOAD
#   MAC address → intercepted by fingerprint_shim.so via LD_PRELOAD
# No --hostname or --mac-address flags needed at runtime (works on Render/AWS/etc.)
RUN echo "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" > /etc/machine-id
COPY --from=shim-builder /fingerprint_shim.so /app/fingerprint_shim.so
ENV LD_PRELOAD=/app/fingerprint_shim.so

# Use Mesa software renderer with a virtual X11 display (Xvfb)
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV DISPLAY=:99

COPY web-app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY web-app/backend/ .

# Frontend static files served by FastAPI
COPY --from=frontend-builder /frontend/dist ./static

EXPOSE 8080
# Start Xvfb virtual display first, then uvicorn.
# imfusion bind() needs a GLX-capable display even for CPU-only DICOM I/O.
CMD ["sh", "-c", "Xvfb :99 -screen 0 1x1x24 -nolisten tcp & sleep 1 && uvicorn main:app --host 0.0.0.0 --port 8080"]
