"""HTTP routes. Parsing + status mapping only — no domain/solver logic."""
from __future__ import annotations

from fastapi import APIRouter, Query, Request
from slowapi import Limiter

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader, persistence
from ecorace.interface.http.errors import envelope
from ecorace.interface.http.schemas import RunRequest, ScenarioRequest
from fastapi.responses import JSONResponse

try:
    import psutil
except ImportError:
    psutil = None

router = APIRouter(prefix="/api/v1")

_limiter: Limiter | None = None


def init_rate_limits(limiter: Limiter) -> None:
    global _limiter
    _limiter = limiter
    # Apply rate limits to routes after limiter is initialized
    router.routes[0].endpoint = limiter.limit("120/minute")(router.routes[0].endpoint)  # health
    router.routes[1].endpoint = limiter.limit("60/minute")(router.routes[1].endpoint)  # circuits
    router.routes[2].endpoint = limiter.limit("30/minute")(router.routes[2].endpoint)  # create_scenario
    router.routes[3].endpoint = limiter.limit("10/minute")(router.routes[3].endpoint)  # create_run
    router.routes[4].endpoint = limiter.limit("60/minute")(router.routes[4].endpoint)  # get_run
    router.routes[5].endpoint = limiter.limit("30/minute")(router.routes[5].endpoint)  # list_scenarios
    router.routes[6].endpoint = limiter.limit("30/minute")(router.routes[6].endpoint)  # get_scenario
    router.routes[7].endpoint = limiter.limit("30/minute")(router.routes[7].endpoint)  # delete_scenario
    router.routes[8].endpoint = limiter.limit("60/minute")(router.routes[8].endpoint)  # list_runs
    router.routes[9].endpoint = limiter.limit("60/minute")(router.routes[9].endpoint)  # season_weekends


@router.get("/health")
def health(request: Request) -> dict:
    _, tag = data_loader.circuits_bundle()
    breaker = request.app.state.circuit_breaker
    memory_mb = round(psutil.Process().memory_info().rss / 1e6, 1) if psutil else None
    return {
        "status": "ok",
        "dataset_version": tag,
        "weather_version": data_loader.weather_policy().version,
        "solver": {
            "circuit_breaker_open": breaker.is_open(),
            "consecutive_failures": breaker.consecutive_failures,
        },
        "memory_mb": memory_mb,
    }


@router.get("/circuits")
def circuits(request: Request) -> dict:
    circuits = data_loader.circuit_list_sorted()
    _, tag = data_loader.circuits_bundle()
    return {"circuits": circuits, "count": len(circuits), "dataset_version": tag}


@router.post("/scenarios", status_code=201)
def create_scenario(body: ScenarioRequest, request: Request) -> dict:
    result = svc.create_scenario(
        body.race_count,
        body.circuit_ids,
        body.season_year,
        body.max_consecutive,
        body.summer_break_start,
        body.summer_break_end,
        body.pin_end_to_dec_week1,
    )
    request.app.state.scenarios[result["scenario_id"]] = result
    return result


@router.post("/optimization/runs")
def create_run(body: RunRequest, request: Request) -> dict:
    breaker = request.app.state.circuit_breaker
    if breaker.is_open():
        return JSONResponse(
            status_code=503,
            content=envelope("SOLVER_OVERLOADED", "Solver temporarily unavailable due to repeated failures. Please retry shortly.", []),
        )
    budget = body.budget_s if body.budget_s is not None else float(request.app.state.solver_budget_s)
    # Create a scenario first to get scenario_id for linking
    scenario = svc.create_scenario(
        body.race_count,
        body.circuit_ids,
        body.season_year,
        body.max_consecutive,
        body.summer_break_start,
        body.summer_break_end,
        body.pin_end_to_dec_week1,
    )
    request.app.state.scenarios[scenario["scenario_id"]] = scenario
    result = svc.run_optimization(
        body.race_count,
        body.circuit_ids,
        body.season_year,
        budget,
        body.seed,
        scenario_id=scenario["scenario_id"],
        max_consecutive=body.max_consecutive,
        summer_break_start=body.summer_break_start,
        summer_break_end=body.summer_break_end,
        pin_end_to_dec_week1=body.pin_end_to_dec_week1,
    )
    request.app.state.runs[result["run_id"]] = result
    if result["status"] in ("feasible", "feasible_optimal", "feasible_timeout"):
        breaker.record_success()
    else:
        breaker.record_failure()
    return result


@router.get("/optimization/runs/{run_id}")
def get_run(run_id: str, request: Request) -> dict:
    # Try persistence first, fall back to in-memory for backward compatibility
    result = persistence.get_run(run_id)
    if result is None:
        result = request.app.state.runs.get(run_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=envelope("RUN_NOT_FOUND", f"Unknown run_id: {run_id}."),
        )
    return result


@router.get("/scenarios")
def list_scenarios(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), request: Request = None) -> dict:
    scenarios = persistence.list_scenarios(limit=limit, offset=offset)
    return {"scenarios": scenarios, "count": len(scenarios)}


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str, request: Request) -> dict:
    result = persistence.get_scenario(scenario_id)
    if result is None:
        result = request.app.state.scenarios.get(scenario_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=envelope("SCENARIO_NOT_FOUND", f"Unknown scenario_id: {scenario_id}."),
        )
    return result


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: str, request: Request) -> dict:
    deleted = persistence.delete_scenario(scenario_id)
    request.app.state.scenarios.pop(scenario_id, None)
    if not deleted:
        return JSONResponse(
            status_code=404,
            content=envelope("SCENARIO_NOT_FOUND", f"Unknown scenario_id: {scenario_id}."),
        )
    return {"deleted": True, "scenario_id": scenario_id}


@router.get("/optimization/runs")
def list_runs(
    scenario_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    request: Request = None,
) -> dict:
    runs = persistence.list_runs(scenario_id=scenario_id, status=status, limit=limit, offset=offset)
    return {"runs": runs, "count": len(runs)}


@router.get("/seasons/{year}/weekends")
def season_weekends(year: int, request: Request) -> dict:
    try:
        weekends = data_loader.season(year)
    except ValueError as e:
        return JSONResponse(status_code=422, content=envelope("INVALID_HORIZON", str(e)))
    return {
        "year": year,
        "count": len(weekends),
        "weekends": [
            {"id": w.id, "friday": w.friday.isoformat(), "saturday": w.saturday.isoformat(), "sunday": w.sunday.isoformat()}
            for w in weekends
        ],
    }
