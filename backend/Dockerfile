FROM python:3.11-slim

# Stateless pilot: no database, no persistent volume.
# Reference data (circuits, seasons, weather) is baked in at /app/data.
# Do not mount a volume over /app/data.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/src \
    SOLVER_TIMEOUT_SECONDS=30 \
    LOG_LEVEL=INFO

WORKDIR /app
COPY pyproject.toml ./
COPY backend/src ./backend/src
COPY data ./data
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn ecorace.interface.http.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
