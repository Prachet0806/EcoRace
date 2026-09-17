"""Heuristic solver: nearest-neighbor orders + 2-opt, placed via greedy baseline.

Always validator-clean or not returned. Doubles as the OR-Tools hint source.
"""
from __future__ import annotations

import time

from ecorace.analytics.baseline import BaselineInfeasible, build_baseline
from ecorace.domain.calendar.calendar import Calendar
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
        for start in range(len(ids)):
            order_idx = two_opt(nearest_neighbor(ids, matrix, start), matrix)
            order = [ids[i] for i in order_idx]
            try:
                cal = build_baseline(order, weekends, problem.weather)
            except BaselineInfeasible:
                continue
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
