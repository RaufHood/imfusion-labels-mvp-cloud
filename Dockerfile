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
RUN apt-get update && apt-get install -y \
    libgomp1 libgl1 libegl1 libglib2.0-0 libgpg-error0 \
    && rm -rf /var/lib/apt/lists/*

COPY web-app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY web-app/backend/ .

# Frontend static files served by FastAPI
COPY --from=frontend-builder /frontend/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
