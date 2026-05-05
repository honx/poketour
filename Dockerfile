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

# SQLite persistence is handled by a Railway Volume mounted at /data — see
# railway.json + the POKETOUR_DB env var. (Railway rejects the `VOLUME`
# directive, so we just create the directory and let the platform mount over
# it at deploy time.)
RUN mkdir -p /data

EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
