FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/src \
    SOLVER_TIMEOUT_SECONDS=30 \
    LOG_LEVEL=INFO \
    ECORACE_DB_PATH=/var/data/ecorace.db

WORKDIR /app
COPY pyproject.toml ./
COPY backend/src ./backend/src
COPY data ./data
RUN pip install --no-cache-dir .
RUN mkdir -p /var/data

EXPOSE 8000
CMD ["sh", "-c", "uvicorn ecorace.interface.http.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
