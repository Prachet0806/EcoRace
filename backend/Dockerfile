FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/src \
    SOLVER_TIMEOUT_SECONDS=30 \
    LOG_LEVEL=INFO \
    ECORACE_DB_PATH=/app/data/ecorace.db

WORKDIR /app
COPY pyproject.toml ./
COPY backend/src ./backend/src
COPY data ./data
RUN pip install --no-cache-dir "fastapi==0.128.2" "pydantic==2.12.5" "ortools==9.15.6755" "uvicorn==0.40.0" "slowapi==0.1.9" "psutil==7.0.0" "python-json-logger==2.0.7"

VOLUME /app/data
EXPOSE 8000
CMD ["uvicorn", "ecorace.interface.http.app:app", "--host", "0.0.0.0", "--port", "8000"]
