"""Application orchestration: scenarios + optimization runs.

Owns the use-case flow (load inputs -> validate -> optimize -> present) and
the MVP in-memory stores. No HTTP, no solver syntax, no SQL here — only
calls into domain/optimization/infrastructure adapters.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from ecorace.analytics.distance import haversine_km
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import (
    DuplicateCircuit,
    ExcessCircuits,
    InsufficientCircuits,
    InvalidRaceCount,
    Scenario,
    UnknownCircuit,
    validate_scenario,
)
from ecorace.infrastructure import data_loader
from ecorace.optimization.model import OptimizationResult, SolveStatus, SolverConfig
from ecorace.optimization.pipeline import InfeasibleProblem, build_problem, optimize
from ecorace.optimization.validator import SolutionValidator

_DOMAIN_ERRORS = (InsufficientCircuits, ExcessCircuits, DuplicateCircuit, UnknownCircuit, InvalidRaceCount)


@dataclass
class AppError(Exception):
    code: str
    message: str
    details: list[dict] = field(default_factory=list)
    status_code: int = 422


def _domain_error_code(exc: Exception) -> str:
    return getattr(exc, "code", type(exc).__name__)


def create_scenario(race_count: int, circuit_ids: list[str], season_year: int) -> dict:
    circuits, _ = data_loader.circuits_bundle()
    weekends = data_loader.season(season_year)
    scenario = Scenario(race_count=race_count, circuit_ids=tuple(circuit_ids), season_year=season_year)
    try:
        validate_scenario(scenario, set(circuits))
    except _DOMAIN_ERRORS as e:
        raise AppError(code=_domain_error_code(e), message=str(e), status_code=422) from e
    return {
        "scenario_id": f"scn_{uuid.uuid4().hex[:12]}",
        "race_count": race_count,
        "circuit_ids": list(circuit_ids),
        "season_year": season_year,
        "weekend_count": len(weekends),
        "horizon": {"start": weekends[0].id, "end": weekends[-1].id},
    }


def run_optimization(
    race_count: int,
    circuit_ids: list[str],
    season_year: int,
    total_budget_s: float,
    seed: int = 0,
) -> dict:
    circuits, circuits_tag = data_loader.circuits_bundle()
    weather = data_loader.weather_policy()
    try:
        weekends = data_loader.season(season_year)
    except ValueError as e:
        raise AppError(code="INVALID_HORIZON", message=str(e), status_code=422) from e
    scenario = Scenario(race_count=race_count, circuit_ids=tuple(circuit_ids), season_year=season_year)
    try:
        problem = build_problem(scenario, circuits, weekends, weather, data_version=circuits_tag)
    except _DOMAIN_ERRORS as e:
        raise AppError(code=_domain_error_code(e), message=str(e), status_code=422) from e
    except InfeasibleProblem as e:
        raise AppError(code="SCENARIO_INFEASIBLE", message=str(e), status_code=422) from e

    per_seed = max(1.0, total_budget_s / 3.0)
    result = optimize(problem, SolverConfig(time_limit_s=per_seed, seed=seed))
    return present_result(result, scenario, weekends, weather, circuits_tag)


def present_result(result: OptimizationResult, scenario: Scenario, problem_weekends, weather, circuits_tag: str) -> dict:
    circuits, _ = data_loader.circuits_bundle()
    if result.status == SolveStatus.INFEASIBLE:
        raise AppError(code="SCENARIO_INFEASIBLE", message="No feasible calendar satisfies the configured constraints.", status_code=422)
    if result.status == SolveStatus.SOLVER_TIMEOUT:
        raise AppError(
            code="SOLVER_TIMEOUT",
            message="Solver exhausted its budget without a solution.",
            details=[{"runtime_ms": result.solver.runtime_ms if result.solver else None}],
            status_code=504,
        )
    if result.status == SolveStatus.SOLVER_FAILURE or result.calendar is None:
        raise AppError(code="SOLVER_FAILURE", message="Solver failed without a usable result.", status_code=500)

    cal: Calendar = result.calendar
    pos = {w.id: n for n, w in enumerate(problem_weekends)}
    races = []
    for i, wid in enumerate(sorted(cal.assignment, key=pos.__getitem__)):
        w = problem_weekends[pos[wid]]
        c = circuits[cal.assignment[wid]]
        races.append(
            {
                "race_id": f"race-{i + 1:02d}",
                "weekend_id": wid,
                "friday": w.friday.isoformat(),
                "saturday": w.saturday.isoformat(),
                "sunday": w.sunday.isoformat(),
                "circuit_id": c.id,
                "circuit_name": c.name,
                "latitude": c.latitude,
                "longitude": c.longitude,
            }
        )
    segments = []
    for i in range(len(races) - 1):
        a, b = races[i], races[i + 1]
        segments.append(
            {
                "segment_id": f"seg-{i + 1:02d}",
                "from_race_id": a["race_id"],
                "to_race_id": b["race_id"],
                "from_circuit_id": a["circuit_id"],
                "to_circuit_id": b["circuit_id"],
                "distance_km": round(haversine_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"]), 2),
            }
        )
    weekend_ids = [w.id for w in problem_weekends]
    breaks = [w.id for w in problem_weekends if w.id not in cal.assignment]
    violations = [
        {"code": v.code, "message": v.message, "weekend_id": v.weekend_id, "circuit_id": v.circuit_id}
        for v in SolutionValidator.validate(cal, scenario, problem_weekends, weather)
    ]
    saving = None
    if result.total_distance_km is not None and result.baseline_distance_km:
        saving = round(result.baseline_distance_km - result.total_distance_km, 2)
    return {
        "run_id": f"run_{uuid.uuid4().hex[:12]}",
        "status": result.status.value,
        "season_year": problem_weekends[0].friday.year,
        "calendar": {
            "races": races,
            "breaks": breaks,
            "weekend_count": len(weekend_ids),
            "race_count": cal.race_count(),
            "break_count": cal.break_count(),
            "max_streak": cal.max_streak(),
        },
        "segments": segments,
        "metrics": {
            "total_distance_km": round(result.total_distance_km, 2),
            "baseline_distance_km": round(result.baseline_distance_km, 2) if result.baseline_distance_km else None,
            "saving_km": saving,
            "baseline_status": result.diagnostics.get("baseline_status"),
        },
        "constraints": [
            {"name": "weather", "satisfied": not any(v["code"] == "WEATHER_INFEASIBLE" for v in violations), "violations": [v for v in violations if v["code"] == "WEATHER_INFEASIBLE"]},
            {"name": "max_consecutive_3", "satisfied": not any(v["code"] == "STREAK_VIOLATION" for v in violations), "violations": [v for v in violations if v["code"] == "STREAK_VIOLATION"]},
            {"name": "race_count_unique", "satisfied": not any(v["code"] in ("RACE_COUNT_MISMATCH", "DUPLICATE_CIRCUIT", "UNSELECTED_CIRCUIT", "UNKNOWN_WEEKEND") for v in violations), "violations": [v for v in violations if v["code"] in ("RACE_COUNT_MISMATCH", "DUPLICATE_CIRCUIT", "UNSELECTED_CIRCUIT", "UNKNOWN_WEEKEND")]},
        ],
        "solver": {
            "name": result.solver.solver_name if result.solver else None,
            "version": result.solver.solver_version if result.solver else None,
            "runtime_ms": result.solver.runtime_ms if result.solver else None,
            "seed": result.solver.seed if result.solver else None,
            "status": result.solver.status.value if result.solver else None,
            "optimality_proven": result.solver.optimality_proven if result.solver else False,
            "origin": result.diagnostics.get("origin"),
        },
        "data_version": circuits_tag,
    }
