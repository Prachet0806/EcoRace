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
from ecorace.domain.calendar.weekend import RaceWeekend, summer_break_weekend_ids
from ecorace.domain.circuit.models import Circuit
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.heuristics import HeuristicSolver
from ecorace.optimization.model import (
    OptimizationProblem,
    OptimizationResult,
    SolverConfig,
    SolverMetadata,
    SolveStatus,
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
    break_ids = summer_break_weekend_ids(scenario, weekends)
    if scenario.summer_break_start is not None and not break_ids:
        raise InfeasibleProblem("summer break window covers no horizon weekend")
    open_ids = [w.id for w in weekends if w.id not in break_ids]
    if len(open_ids) < scenario.race_count:
        raise InfeasibleProblem(
            f"only {len(open_ids)} weekends outside the summer break for {scenario.race_count} races"
        )
    if scenario.pin_end_to_dec_week1 and weekends[-1].id in break_ids:
        raise InfeasibleProblem("pinned finale falls inside the summer break window")
    blocked = [
        c
        for c in scenario.circuit_ids
        if not any(weather.is_feasible(c, w.id) for w in weekends if w.id not in break_ids)
    ]
    if blocked:
        raise InfeasibleProblem(f"no feasible weekend for: {blocked}")
    return OptimizationProblem(
        scenario=scenario, weekends=weekends, circuits=circuits, weather=weather, data_version=data_version
    )


def race_order(calendar: Calendar) -> list[str]:
    weekend_pos = {w.id: i for i, w in enumerate(calendar.weekends)}
    return [calendar.assignment[wid] for wid in sorted(calendar.assignment, key=weekend_pos.__getitem__)]


def _baseline_calendar(
    problem: OptimizationProblem,
) -> tuple[Calendar | None, float | None, str]:
    """Greedy input-order baseline plus validator verdict.

    The greedy baseline ignores the monthly-minimum rule by construction,
    so it is often validator-dirty. It must never be presented as a
    comparable "ok" baseline in that case — otherwise a fully-constrained
    optimized calendar looks like a regression (e.g. 139k vs 105k km).
    Returns (calendar_or_none, km_or_none, status).
    Status is "ok" only when the baseline is fully validator-clean and
    therefore a fair comparison; otherwise "infeasible" (greedy failed) or
    "non_comparable:<CODES>" (greedy built but violates hard constraints).
    """
    try:
        cal = build_baseline(
            list(problem.scenario.circuit_ids),
            list(problem.weekends),
            problem.weather,
            max_consecutive=problem.scenario.max_consecutive,
            forbidden_ids=summer_break_weekend_ids(problem.scenario, problem.weekends),
            last_weekend_id=problem.weekends[-1].id if problem.scenario.pin_end_to_dec_week1 else None,
        )
    except BaselineInfeasible:
        return None, None, "infeasible"  # never blocks optimization, per contract
    km = order_distance_km(race_order(cal), problem.circuits)
    violations = SolutionValidator.validate(cal, problem.scenario, problem.weekends, problem.weather)
    if violations:
        codes = sorted({v.code for v in violations})
        return cal, km, f"non_comparable:{'+'.join(codes)}"
    return cal, km, "ok"


def _baseline_km(problem: OptimizationProblem) -> tuple[float | None, str]:
    _, km, status = _baseline_calendar(problem)
    return km, status


def optimize(problem: OptimizationProblem, config: SolverConfig = SolverConfig()) -> OptimizationResult:
    baseline_cal, baseline_km, baseline_status = _baseline_calendar(problem)

    h_cal, h_meta = None, None
    h_out = HeuristicSolver().solve(problem, config)
    if h_out[0] is not None:
        h_cal, _ = h_out[0]
        h_meta = h_out[1]
    else:
        h_meta = h_out[1]

    # Hint only with fully validator-clean calendars. A hint violating any
    # hard constraint (streak, break, pin, monthly cover) poisons CP-SAT
    # hint-repair and stalls first solutions (measured V1.1).
    hint_cal = (
        h_cal
        if h_cal is not None
        and not SolutionValidator.validate(h_cal, problem.scenario, problem.weekends, problem.weather)
        else None
    )

    o_cal, o_meta, last_meta = None, None, None
    attempts: list[dict] = []
    best_km = float("inf")
    # Deterministic portfolio: CP-SAT solution quality is not monotone in the
    # time limit (measured P1: 30s runs worse than 5s at same seed), so run the
    # fixed seed schedule and keep the best validator-clean calendar.
    for idx, s in enumerate(config.seeds or (config.seed,)):
        seed_cfg = SolverConfig(
            time_limit_s=config.time_limit_s,
            seed=s,
            seeds=(s,),
            num_workers=config.num_workers,
            use_hint=config.use_hint,
            # First seed solves WITH presolve: locks the clean hint almost
            # instantly (safety net). Remaining seeds solve WITHOUT presolve:
            # slower first solution, stronger improvement. Keep-best decides.
            # (Measured V1.1 against the monthly-minimum encoding.)
            presolve=(idx == 0),
        )
        cal_s, meta_s = ORToolsSolver().solve(problem, seed_cfg, hint_calendar=hint_cal)
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
    # Guardrail: a validator-clean baseline is itself a candidate
    # (origin="baseline"), so optimized can never regress vs a comparable
    # baseline. A dirty baseline (usual case: monthly-minimum violation) is
    # NOT a candidate and stays flagged non_comparable in diagnostics.
    best: tuple[Calendar, SolverMetadata, SolveStatus, str] | None = None
    best_km = float("inf")
    if baseline_cal is not None and baseline_status == "ok" and baseline_km is not None:
        baseline_meta = SolverMetadata(
            solver_name="baseline",
            solver_version="greedy-v1",
            seed=config.seed,
            runtime_ms=0,
            time_limit_s=0.0,
            status=SolveStatus.FEASIBLE,
            objective_km=baseline_km,
            data_version=problem.data_version,
        )
        best = (baseline_cal, baseline_meta, SolveStatus.FEASIBLE, "baseline")
        best_km = baseline_km
    if h_cal is not None:
        h_viol = SolutionValidator.validate(h_cal, problem.scenario, problem.weekends, problem.weather)
        if not h_viol:
            h_km = order_distance_km(race_order(h_cal), problem.circuits)
            if h_km < best_km:
                best = (h_cal, h_meta, SolveStatus.FEASIBLE, "heuristic")
                best_km = h_km
    if o_cal is not None:
        o_km = order_distance_km(race_order(o_cal), problem.circuits)
        if o_km < best_km:
            o_status = (
                SolveStatus.FEASIBLE_OPTIMAL
                if o_meta.status == SolveStatus.FEASIBLE_OPTIMAL
                else SolveStatus.FEASIBLE_TIMEOUT  # P0-08: non-optimal stays marked
                if o_meta.status == SolveStatus.FEASIBLE_TIMEOUT
                else SolveStatus.FEASIBLE
            )
            best = (o_cal, o_meta, o_status, "ortools")
            best_km = o_km
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
