"""HTTP routes. Parsing + status mapping only — no domain/solver logic."""

from __future__ import annotations

import hashlib
import uuid

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader, persistence
from ecorace.interface.http.errors import envelope
from ecorace.interface.http.schemas import RunRequest
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

try:
    import psutil
except ImportError:
    psutil = None

router = APIRouter(prefix="/api/v1")

@router.get("/health")
def health(request: Request) -> dict:
    if not persistence.database_health():
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "unavailable"},
        )
    _, tag = data_loader.circuits_bundle()
    breaker = request.app.state.circuit_breaker
    memory_mb = round(psutil.Process().memory_info().rss / 1e6, 1) if psutil else None
    return {
        "status": "ok",
        "database": "ok",
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
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    request_hash = hashlib.sha256(body.model_dump_json().encode("utf-8")).hexdigest()
    if idempotency_key is not None:
        try:
            parsed = uuid.UUID(idempotency_key)
            if parsed.version != 4 or str(parsed) != idempotency_key:
                raise ValueError("not a canonical UUID v4")
        except ValueError:
            return JSONResponse(
                status_code=400,
                content=envelope("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be a UUID v4."),
            )
        state, run_id = persistence.claim_submission(idempotency_key, request_hash)
        if state == "conflict":
            return JSONResponse(
                status_code=409,
                content=envelope("IDEMPOTENCY_CONFLICT", "This key was used for a different request."),
            )
        if state == "running":
            return JSONResponse(
                status_code=409,
                headers={"Retry-After": "2"},
                content=envelope("REQUEST_IN_PROGRESS", "This optimization is still running."),
            )
        if state == "completed":
            cached = persistence.get_run(run_id) if run_id else None
            if cached is not None:
                return cached
            return JSONResponse(
                status_code=503,
                content=envelope("RESULT_UNAVAILABLE", "The completed result could not be read."),
            )
    breaker = request.app.state.circuit_breaker
    if breaker.is_open():
        if idempotency_key is not None:
            persistence.fail_submission(idempotency_key, request_hash)
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
        if idempotency_key is not None:
            persistence.fail_submission(idempotency_key, request_hash)
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
            persist=False,
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
            )
        except svc.AppError as exc:
            if exc.code in ("SOLVER_FAILURE", "SOLVER_TIMEOUT"):
                breaker.record_failure()
            raise
        except Exception:
            breaker.record_failure()
            raise
        persistence.save_scenario_and_run(
            scenario, result, submission_key=idempotency_key,
            request_sha256=request_hash if idempotency_key is not None else None,
        )
        breaker.record_success()
        return result
    except Exception:
        if idempotency_key is not None:
            persistence.fail_submission(idempotency_key, request_hash)
        raise
    finally:
        request.app.state.solver_slots.release()


@router.get("/optimization/runs/{run_id}")
def get_run(run_id: str, request: Request) -> dict:
    result = persistence.get_run(run_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=envelope("RUN_NOT_FOUND", f"Unknown run_id: {run_id}."),
        )
    return result


@router.get("/optimization/submissions/{key}")
def get_submission(key: str, request: Request) -> dict:
    status = persistence.get_submission(key)
    if status is None:
        return JSONResponse(
            status_code=404,
            content=envelope("SUBMISSION_NOT_FOUND", "Unknown submission key."),
        )
    return status


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
