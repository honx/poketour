# --- frontend build --------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- backend runtime -------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POKETOUR_STATIC_DIR=/app/static \
    POKETOUR_DB=/data/poketour.db

WORKDIR /app

# Install backend deps first for cacheability
COPY backend/pyproject.toml ./backend/pyproject.toml
RUN pip install --upgrade pip && pip install ./backend

# Source + content
COPY backend/app ./backend/app
COPY backend/data ./backend/data

# Built frontend assets
COPY --from=frontend /build/dist ./static

# Persist SQLite outside the image so redeploys don't wipe progress.
# Railway: attach a volume, mount it at /data.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
