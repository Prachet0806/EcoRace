"""Heuristic solver: nearest-neighbor orders + 2-opt, placed via greedy baseline.

Always validator-clean or not returned. Doubles as the OR-Tools hint source.
"""

from __future__ import annotations

import time

from ecorace.analytics.baseline import (
    BaselineInfeasible,
    build_baseline,
    would_break_streak,
)
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.weekend import covered_months, summer_break_weekend_ids
from ecorace.optimization.model import (
    OptimizationProblem,
    SolverConfig,
    SolverMetadata,
    SolveStatus,
    build_distance_matrix,
    order_distance_km,
)
from ecorace.optimization.quality import route_quality
from ecorace.optimization.validator import SolutionValidator


def nearest_neighbor(
    order_ids: list[str], matrix: list[list[float]], start: int
) -> list[int]:
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


def regional_cluster_order(
    order_ids: list[str], circuits: dict, matrix: list[list[float]], start: int,
) -> list[int]:
    """Visit each region once, choosing its nearest entry from the last stop."""
    groups: dict[str, set[int]] = {}
    for index, cid in enumerate(order_ids):
        groups.setdefault(circuits[cid].region, set()).add(index)
    current_region = circuits[order_ids[start]].region
    path = [start]
    groups[current_region].remove(start)
    while any(groups.values()):
        if not groups[current_region]:
            current_region = min(
                (region for region, members in groups.items() if members),
                key=lambda region: min((matrix[path[-1]][j], j) for j in groups[region]),
            )
        nxt = min(groups[current_region], key=lambda j: (matrix[path[-1]][j], j))
        path.append(nxt)
        groups[current_region].remove(nxt)
    return path


def region_repair_orders(path: list[int], order_ids: list[str], circuits: dict) -> list[list[int]]:
    """Move one repeated region block next to its previous visit."""
    regions = [circuits[order_ids[index]].region for index in path]
    blocks: list[tuple[str, int, int]] = []
    start = 0
    for end in range(1, len(path) + 1):
        if end == len(path) or regions[end] != regions[start]:
            blocks.append((regions[start], start, end))
            start = end
    repaired = []
    for earlier, (region, _, insertion) in enumerate(blocks):
        for later_region, later_start, later_end in blocks[earlier + 2 :]:
            if later_region != region:
                continue
            moved = path[later_start:later_end]
            remaining = path[:later_start] + path[later_end:]
            repaired.append(remaining[:insertion] + moved + remaining[insertion:])
            if len(moved) > 1:
                repaired.append(remaining[:insertion] + moved[::-1] + remaining[insertion:])
    return repaired


def place_with_monthly_cover(
    order: list[str],
    weekends: list,
    weather,
    max_consecutive: int,
    break_ids: frozenset[str],
    last_weekend_id: str | None,
) -> Calendar:
    """Greedy placement guaranteeing one race per covered month.

    The TSP `order` is split into contiguous chunks — one chunk per covered
    month, sized proportionally to that month's open weekends — so
    time-adjacent races stay tour-adjacent and regional grouping survives
    placement. (Spreading the tour head one-per-month instead more than
    doubles routed distance on a 24-race calendar — measured.) A circuit
    that fits nowhere in its own month spills to the nearest other open
    weekend. Raises BaselineInfeasible on failure.
    """
    covered = covered_months(weekends, break_ids)
    months = sorted(covered)
    occupied: dict[str, str] = {}
    occupied_ids: set[str] = set()
    wpos = {w.id: i for i, w in enumerate(weekends)}

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

    reserve_last = order[-1] if last_weekend_id else None
    placeable = order[:-1] if last_weekend_id else order
    if len(placeable) < len(months):
        raise BaselineInfeasible("fewer circuits than covered months")

    open_ids = {
        m: [weekends[wi].id for wi in covered[m] if weekends[wi].id not in break_ids]
        for m in months
    }
    if months:
        # Contiguous chunk sizes proportional to open weekends per month.
        total_open = sum(len(v) for v in open_ids.values())
        sizes: list[int] = []
        acc = 0.0
        for m in months:
            acc += len(open_ids[m]) / total_open * len(placeable)
            sizes.append(max(1, round(acc) - sum(sizes)))
        # Fix rounding drift so chunks partition `placeable` exactly.
        overflow = sum(sizes) - len(placeable)
        for i in sorted(range(len(sizes)), key=lambda i: -sizes[i]):
            if overflow <= 0:
                break
            take = min(overflow, sizes[i] - 1)
            sizes[i] -= take
            overflow -= take
        if overflow > 0:
            raise BaselineInfeasible("cannot partition circuits across covered months")
        sizes[-1] += len(placeable) - sum(sizes)
        idx = 0
        for m, s in zip(months, sizes):
            center = sum(wpos[wid] for wid in open_ids[m]) / len(open_ids[m])
            spill = sorted(
                (w.id for w in weekends if w.id not in break_ids),
                key=lambda wid: abs(wpos[wid] - center),
            )
            for c in placeable[idx : idx + s]:
                if try_place(c, open_ids[m]):
                    continue
                if not try_place(c, spill):
                    raise BaselineInfeasible(
                        f"no feasible weekend for {c} in monthly cover"
                    )
            idx += s
    else:
        for c in placeable:
            if not try_place(c, [w.id for w in weekends]):
                raise BaselineInfeasible(
                    f"no feasible weekend for {c} in baseline order"
                )
    if last_weekend_id:
        assert reserve_last is not None
        if (
            last_weekend_id in break_ids
            or last_weekend_id in occupied
            or not weather.is_feasible(reserve_last, last_weekend_id)
            or would_break_streak(
                occupied_ids, last_weekend_id, weekends, max_consecutive
            )
        ):
            raise BaselineInfeasible(
                f"no feasible weekend for {reserve_last} in baseline order"
            )
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

        candidates: list[tuple[float, dict, Calendar, list[str]]] = []
        scen = problem.scenario
        break_ids = summer_break_weekend_ids(scen, problem.weekends)
        last_id = problem.weekends[-1].id if scen.pin_end_to_dec_week1 else None
        for start in range(len(ids)):
            if (
                config.deadline_monotonic is not None
                and time.monotonic() >= config.deadline_monotonic
            ):
                break
            shortest_order = two_opt(nearest_neighbor(ids, matrix, start), matrix)
            orders = [shortest_order]
            orders.extend(region_repair_orders(shortest_order, ids, problem.circuits))
            clustered = regional_cluster_order(ids, problem.circuits, matrix, start)
            if clustered != orders[0]:
                orders.append(clustered)
            for order_idx in orders:
                if config.deadline_monotonic is not None and time.monotonic() >= config.deadline_monotonic:
                    break
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
                        order,
                        weekends,
                        problem.weather,
                        scen.max_consecutive,
                        break_ids,
                        last_id,
                    ),
                ):
                    try:
                        cals.append(attempt())
                    except BaselineInfeasible:
                        continue
                for cal in cals:
                    if SolutionValidator.validate(cal, scen, problem.weekends, problem.weather):
                        continue
                    placed = [cal.assignment[w.id] for w in weekends if w.id in cal.assignment]
                    km = order_distance_km(placed, problem.circuits)
                    candidates.append((km, route_quality(placed, problem.circuits), cal, order))

        runtime_ms = int((time.perf_counter() - t0) * 1000)
        if not candidates:
            return None, SolverMetadata(
                solver_name=self.name,
                solver_version="nn-2opt-regional-v2",
                seed=config.seed,
                runtime_ms=runtime_ms,
                time_limit_s=config.time_limit_s,
                status=SolveStatus.INFEASIBLE,
                data_version=problem.data_version,
            )
        shortest = min(candidate[0] for candidate in candidates)
        eligible = [candidate for candidate in candidates if candidate[0] <= shortest * 1.02]
        best_km, _, best_cal, best_order = min(
            eligible,
            key=lambda candidate: (
                candidate[1]["region_backtracks"],
                candidate[1]["hops_over_5000_km"],
                candidate[1]["longest_hop_km"],
                candidate[0],
            ),
        )
        return (best_cal, best_order), SolverMetadata(
            solver_name=self.name,
            solver_version="nn-2opt-regional-v2",
            seed=config.seed,
            runtime_ms=runtime_ms,
            time_limit_s=config.time_limit_s,
            status=SolveStatus.FEASIBLE,
            objective_km=best_km,
            shortest_candidate_km=shortest,
            data_version=problem.data_version,
        )
