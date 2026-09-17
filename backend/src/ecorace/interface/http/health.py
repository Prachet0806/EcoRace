"""Phase 0 health stub (interface shell; full FastAPI app lands in Phase 3)."""
from fastapi import FastAPI

app = FastAPI(title="EcoRace Planner")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
