"""HTTP routes. Parsing + status mapping only — no domain/solver logic."""

from __future__ import annotations

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader
from ecorace.interface.http.errors import envelope
from ecorace.interface.http.schemas import RunRequest
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

try:
    import psutil
except ImportError:
    psutil = None

router = APIRouter(prefix="/api/v1")


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


@router.post("/optimization/runs")
def create_run(
    body: RunRequest, request: Request,
) -> dict:
    breaker = request.app.state.circuit_breaker
    if breaker.is_open():
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "5"},
            content=envelope(
                "SOLVER_OVERLOADED",
                "Solver temporarily unavailable due to repeated failures. Please retry shortly.",
                [],
            ),
        )
    if not request.app.state.solver_slots.acquire(blocking=False):
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "5"},
            content=envelope(
                "SOLVER_OVERLOADED", "All solver slots are busy. Retry shortly."
            ),
        )
    try:
        budget = min(
            body.budget_s if body.budget_s is not None else float(request.app.state.solver_budget_s),
            float(request.app.state.solver_budget_s),
        )
        scenario = svc.create_scenario(
            body.race_count,
            body.circuit_ids,
            body.season_year,
            body.max_consecutive,
            body.summer_break_start,
            body.summer_break_end,
            body.pin_end_to_dec_week1,
        )
        try:
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
                first_attempt_presolve=request.app.state.solver_first_attempt_presolve,
                diagnostics_enabled=request.app.state.solver_diagnostics_enabled,
            )
        except svc.AppError as exc:
            if exc.code in ("SOLVER_FAILURE", "SOLVER_TIMEOUT"):
                breaker.record_failure()
            raise
        except Exception:
            breaker.record_failure()
            raise
        breaker.record_success()
        return result
    except Exception:
        raise
    finally:
        request.app.state.solver_slots.release()


@router.get("/seasons/{year}/weekends")
def season_weekends(year: int, request: Request) -> dict:
    try:
        weekends = data_loader.season(year)
    except ValueError as e:
        return JSONResponse(
            status_code=422, content=envelope("INVALID_HORIZON", str(e))
        )
    return {
        "year": year,
        "count": len(weekends),
        "weekends": [
            {
                "id": w.id,
                "friday": w.friday.isoformat(),
                "saturday": w.saturday.isoformat(),
                "sunday": w.sunday.isoformat(),
            }
            for w in weekends
        ],
    }
