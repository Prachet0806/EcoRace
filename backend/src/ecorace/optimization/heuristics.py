"""Heuristic solver: nearest-neighbor orders + 2-opt, placed via greedy baseline.

Always validator-clean or not returned. Doubles as the OR-Tools hint source.
"""
from __future__ import annotations

import time

from ecorace.analytics.baseline import BaselineInfeasible, build_baseline, would_break_streak
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.weekend import covered_months, summer_break_weekend_ids
from ecorace.optimization.validator import SolutionValidator
from ecorace.optimization.model import (
    OptimizationProblem,
    SolveStatus,
    SolverConfig,
    SolverMetadata,
    build_distance_matrix,
    order_distance_km,
)


def nearest_neighbor(order_ids: list[str], matrix: list[list[float]], start: int) -> list[int]:
    n = len(order_ids)
    unvisited = set(range(n))
    path = [start]
    unvisited.discard(start)
    while unvisited:
        last = path[-1]
        nxt = min(unvisited, key=lambda j: (matrix[last][j], j))
        path.append(nxt)
        unvisited.discard(nxt)
    return path


def two_opt(path: list[int], matrix: list[list[float]]) -> list[int]:
    def cost(p: list[int]) -> float:
        return sum(matrix[p[i]][p[i + 1]] for i in range(len(p) - 1))

    best = list(path)
    improved = True
    while improved:
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best)):
                if j - i == 1:
                    continue
                cand = best[:i] + best[i:j][::-1] + best[j:]
                if cost(cand) < cost(best) - 1e-9:
                    best = cand
                    improved = True
    return best


def place_with_monthly_cover(
    order: list[str],
    weekends: list,
    weather,
    max_consecutive: int,
    break_ids: frozenset[str],
    last_weekend_id: str | None,
) -> Calendar:
    """Greedy placement guaranteeing one race per covered month.

    First pass assigns the leading circuits (in order) one per covered
    month at the earliest feasible weekend; remaining circuits fill the
    earliest feasible weekends. Raises BaselineInfeasible on failure.
    """
    covered = covered_months(weekends, break_ids)
    occupied: dict[str, str] = {}
    occupied_ids: set[str] = set()

    def try_place(circuit_id: str, candidates: list[str]) -> bool:
        for wid in candidates:
            if wid in occupied or wid in break_ids:
                continue
            if last_weekend_id is not None and wid == last_weekend_id:
                continue
            if not weather.is_feasible(circuit_id, wid):
                continue
            if would_break_streak(occupied_ids, wid, weekends, max_consecutive):
                continue
            occupied[wid] = circuit_id
            occupied_ids.add(wid)
            return True
        return False

    it = None
    reserve_last = order[-1] if last_weekend_id else None
    placeable = order[:-1] if last_weekend_id else order
    if len(placeable) < len(covered):
        raise BaselineInfeasible("fewer circuits than covered months")
    month_iter = iter(placeable)
    for month in sorted(covered):
        c = next(month_iter)
        if not try_place(c, [weekends[wi].id for wi in covered[month]]):
            raise BaselineInfeasible(f"no feasible weekend for {c} in monthly cover")
    for c in month_iter:
        if not try_place(c, [w.id for w in weekends]):
            raise BaselineInfeasible(f"no feasible weekend for {c} in baseline order")
    if last_weekend_id:
        assert reserve_last is not None
        if (
            last_weekend_id in break_ids
            or last_weekend_id in occupied
            or not weather.is_feasible(reserve_last, last_weekend_id)
            or would_break_streak(occupied_ids, last_weekend_id, weekends, max_consecutive)
        ):
            raise BaselineInfeasible(f"no feasible weekend for {reserve_last} in baseline order")
        occupied[last_weekend_id] = reserve_last
        occupied_ids.add(last_weekend_id)
    return Calendar(weekends=tuple(weekends), assignment=occupied)


class HeuristicSolver:
    name = "heuristic"

    def solve(self, problem: OptimizationProblem, config: SolverConfig):
        t0 = time.perf_counter()
        ids = list(problem.scenario.circuit_ids)
        weekends = list(problem.weekends)
        matrix = build_distance_matrix(problem.circuits, ids)

        best_cal: Calendar | None = None
        best_km = float("inf")
        best_order: list[str] | None = None
        scen = problem.scenario
        break_ids = summer_break_weekend_ids(scen, problem.weekends)
        last_id = problem.weekends[-1].id if scen.pin_end_to_dec_week1 else None
        for start in range(len(ids)):
            order_idx = two_opt(nearest_neighbor(ids, matrix, start), matrix)
            order = [ids[i] for i in order_idx]
            cals: list[Calendar] = []
            for attempt in (
                lambda: build_baseline(
                    order,
                    weekends,
                    problem.weather,
                    max_consecutive=scen.max_consecutive,
                    forbidden_ids=break_ids,
                    last_weekend_id=last_id,
                ),
                lambda: place_with_monthly_cover(
                    order, weekends, problem.weather, scen.max_consecutive, break_ids, last_id
                ),
            ):
                try:
                    cals.append(attempt())
                except BaselineInfeasible:
                    continue
            for cal in cals:
                if SolutionValidator.validate(cal, scen, problem.weekends, problem.weather):
                    continue  # never prefer a dirty calendar, even a short one
                km = order_distance_km(
                    [cal.assignment[w.id] for w in weekends if w.id in cal.assignment],
                    problem.circuits,
                )
                if km < best_km:
                    best_km, best_cal, best_order = km, cal, order

        runtime_ms = int((time.perf_counter() - t0) * 1000)
        if best_cal is None:
            return None, SolverMetadata(
                solver_name=self.name,
                solver_version="nn-2opt-v1",
                seed=config.seed,
                runtime_ms=runtime_ms,
                time_limit_s=config.time_limit_s,
                status=SolveStatus.INFEASIBLE,
                data_version=problem.data_version,
            )
        return (best_cal, best_order), SolverMetadata(
            solver_name=self.name,
            solver_version="nn-2opt-v1",
            seed=config.seed,
            runtime_ms=runtime_ms,
            time_limit_s=config.time_limit_s,
            status=SolveStatus.FEASIBLE,
            objective_km=best_km,
            data_version=problem.data_version,
        )
