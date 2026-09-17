"""HTTP routes. Parsing + status mapping only — no domain/solver logic."""
from __future__ import annotations

from fastapi import APIRouter, Request

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader
from ecorace.interface.http.errors import envelope
from ecorace.interface.http.schemas import RunRequest, ScenarioRequest
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health() -> dict:
    _, tag = data_loader.circuits_bundle()
    return {"status": "ok", "dataset_version": tag, "weather_version": data_loader.weather_policy().version}


@router.get("/circuits")
def circuits() -> dict:
    circuits = data_loader.circuit_list_sorted()
    _, tag = data_loader.circuits_bundle()
    return {"circuits": circuits, "count": len(circuits), "dataset_version": tag}


@router.post("/scenarios", status_code=201)
def create_scenario(body: ScenarioRequest, request: Request) -> dict:
    result = svc.create_scenario(body.race_count, body.circuit_ids, body.season_year)
    request.app.state.scenarios[result["scenario_id"]] = result
    return result


@router.post("/optimization/runs")
def create_run(body: RunRequest, request: Request) -> dict:
    budget = body.budget_s if body.budget_s is not None else float(request.app.state.solver_budget_s)
    result = svc.run_optimization(body.race_count, body.circuit_ids, body.season_year, budget, body.seed)
    request.app.state.runs[result["run_id"]] = result
    return result


@router.get("/optimization/runs/{run_id}")
def get_run(run_id: str, request: Request) -> dict:
    result = request.app.state.runs.get(run_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=envelope("RUN_NOT_FOUND", f"Unknown run_id: {run_id}."),
        )
    return result
