"""Standalone optimization pipeline: precheck → heuristic → OR-Tools → validate → metrics.

Executable with no HTTP server, database, frontend, or external service:

    result = optimize(problem)

Every returned calendar is independently validator-clean. A solver claim of
INFEASIBLE is only trusted when no validator-clean calendar exists; otherwise
the clean calendar wins and the disagreement is recorded, never hidden.
"""
from __future__ import annotations

from ecorace.analytics.baseline import BaselineInfeasible, build_baseline
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario, validate_scenario
from ecorace.domain.calendar.weekend import RaceWeekend
from ecorace.domain.circuit.models import Circuit
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.heuristics import HeuristicSolver
from ecorace.optimization.model import (
    OptimizationProblem,
    OptimizationResult,
    SolveStatus,
    SolverConfig,
    order_distance_km,
)
from ecorace.optimization.ortools_solver import ORToolsSolver
from ecorace.optimization.validator import SolutionValidator


class InfeasibleProblem(Exception):
    """Precheck failure: no feasible calendar can exist for the inputs."""


def build_problem(
    scenario: Scenario,
    circuits: dict[str, Circuit],
    weekends: tuple[RaceWeekend, ...],
    weather: WeatherPolicy,
    data_version: str = "unknown",
) -> OptimizationProblem:
    validate_scenario(scenario, set(circuits))
    blocked = [c for c in scenario.circuit_ids if not any(weather.is_feasible(c, w.id) for w in weekends)]
    if blocked:
        raise InfeasibleProblem(f"no feasible weekend for: {blocked}")
    return OptimizationProblem(
        scenario=scenario, weekends=weekends, circuits=circuits, weather=weather, data_version=data_version
    )


def race_order(calendar: Calendar) -> list[str]:
    weekend_pos = {w.id: i for i, w in enumerate(calendar.weekends)}
    return [calendar.assignment[wid] for wid in sorted(calendar.assignment, key=weekend_pos.__getitem__)]


def _baseline_km(problem: OptimizationProblem) -> tuple[float | None, str]:
    try:
        cal = build_baseline(list(problem.scenario.circuit_ids), list(problem.weekends), problem.weather)
    except BaselineInfeasible:
        return None, "infeasible"  # never blocks optimization, per contract
    return order_distance_km(race_order(cal), problem.circuits), "ok"


def optimize(problem: OptimizationProblem, config: SolverConfig = SolverConfig()) -> OptimizationResult:
    baseline_km, baseline_status = _baseline_km(problem)

    h_cal, h_order, h_meta = None, None, None
    h_out = HeuristicSolver().solve(problem, config)
    if h_out[0] is not None:
        (h_cal, h_order), h_meta = h_out
    else:
        h_meta = h_out[1]

    o_cal, o_meta, last_meta = None, None, None
    attempts: list[dict] = []
    best_km = float("inf")
    # Deterministic portfolio: CP-SAT solution quality is not monotone in the
    # time limit (measured P1: 30s runs worse than 5s at same seed), so run the
    # fixed seed schedule and keep the best validator-clean calendar.
    for s in config.seeds or (config.seed,):
        seed_cfg = SolverConfig(
            time_limit_s=config.time_limit_s,
            seed=s,
            seeds=(s,),
            num_workers=config.num_workers,
            use_hint=config.use_hint,
        )
        cal_s, meta_s = ORToolsSolver().solve(problem, seed_cfg, hint_calendar=h_cal)
        last_meta = meta_s
        km_s = None
        if cal_s is not None and not SolutionValidator.validate(cal_s, problem.scenario, problem.weekends, problem.weather):
            km_s = order_distance_km(race_order(cal_s), problem.circuits)
            if km_s < best_km:
                best_km, o_cal, o_meta = km_s, cal_s, meta_s
        attempts.append({"seed": s, "status": meta_s.status.value, "km": km_s})
    if o_meta is None:
        o_meta = last_meta  # every seed failed cleanly (timeout/infeasible)

    diagnostics = {
        "heuristic_km": h_meta.objective_km,
        "heuristic_status": h_meta.status.value,
        "baseline_status": baseline_status,
        "solver_disagreement": False,
        "attempts": attempts,
    }

    # Best validator-clean calendar wins, regardless of origin. Never prefer a
    # worse solver solution over a better heuristic one (or vice versa).
    best: tuple[Calendar, SolverMetadata, SolveStatus, str] | None = None
    if h_cal is not None:
        h_viol = SolutionValidator.validate(h_cal, problem.scenario, problem.weekends, problem.weather)
        if not h_viol:
            best = (h_cal, h_meta, SolveStatus.FEASIBLE, "heuristic")
    if o_cal is not None:
        o_km = order_distance_km(race_order(o_cal), problem.circuits)
        h_km = order_distance_km(race_order(best[0]), problem.circuits) if best else float("inf")
        if o_km <= h_km:
            o_status = (
                SolveStatus.FEASIBLE_OPTIMAL
                if o_meta.status == SolveStatus.FEASIBLE_OPTIMAL
                else SolveStatus.FEASIBLE_TIMEOUT  # P0-08: non-optimal stays marked
                if o_meta.status == SolveStatus.FEASIBLE_TIMEOUT
                else SolveStatus.FEASIBLE
            )
            best = (o_cal, o_meta, o_status, "ortools")
        elif best is not None and o_meta.status == SolveStatus.INFEASIBLE:
            diagnostics["solver_disagreement"] = True

    if best is not None:
        cal, meta, status, origin = best
        return OptimizationResult(
            status=status,
            calendar=cal,
            total_distance_km=order_distance_km(race_order(cal), problem.circuits),
            baseline_distance_km=baseline_km,
            solver=meta,
            diagnostics={**diagnostics, "origin": origin},
        )

    # No validator-clean calendar exists.
    if o_meta.status == SolveStatus.INFEASIBLE:
        status = SolveStatus.INFEASIBLE
    elif o_meta.status == SolveStatus.SOLVER_TIMEOUT:
        status = SolveStatus.SOLVER_TIMEOUT
    else:
        status = SolveStatus.SOLVER_FAILURE
    return OptimizationResult(
        status=status,
        calendar=None,
        total_distance_km=None,
        baseline_distance_km=baseline_km,
        solver=o_meta,
        diagnostics=diagnostics,
    )
