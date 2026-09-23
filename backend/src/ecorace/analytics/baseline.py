"""Deterministic baseline (P0-07): input order -> earliest feasible weekend.

Respects: occupancy (one/weekend), weather, streak limit, summer-break
exclusions, optional pinned finale. Raises BaselineInfeasible if greedy
placement fails. Greedy failure does NOT imply scenario infeasibility
(documented contract).
"""
from __future__ import annotations

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.weekend import RaceWeekend
from ecorace.domain.constraints.weather import WeatherPolicy


class BaselineInfeasible(Exception):
    code = "BASELINE_INFEASIBLE"


def _would_break_streak(
    occupied_ids: set[str], candidate: str, weekends: list[RaceWeekend], max_consecutive: int = 3
) -> bool:
    order = [w.id for w in weekends]
    trial = sorted(occupied_ids | {candidate}, key=order.index)
    idx = {wid: i for i, wid in enumerate(order)}
    run = 0
    prev = -10
    for wid in trial:
        if idx[wid] == prev + 1:
            run += 1
        else:
            run = 1
        if run > max_consecutive:
            return True
        prev = idx[wid]
    return False


def build_baseline(
    circuit_ids_in_input_order: list[str],
    weekends: list[RaceWeekend],
    weather: WeatherPolicy,
    *,
    max_consecutive: int = 3,
    forbidden_ids: frozenset[str] = frozenset(),
    last_weekend_id: str | None = None,
) -> Calendar:
    occupied: dict[str, str] = {}
    occupied_ids: set[str] = set()
    targets = circuit_ids_in_input_order[:-1] if last_weekend_id else circuit_ids_in_input_order
    pool = [w for w in weekends if w.id not in forbidden_ids and w.id != last_weekend_id]
    for circuit_id in targets:
        placed = False
        for w in pool:
            if w.id in occupied:
                continue
            if not weather.is_feasible(circuit_id, w.id):
                continue
            if _would_break_streak(occupied_ids, w.id, weekends, max_consecutive):
                continue
            occupied[w.id] = circuit_id
            occupied_ids.add(w.id)
            placed = True
            break
        if not placed:
            raise BaselineInfeasible(f"no feasible weekend for {circuit_id} in baseline order")
    if last_weekend_id:
        final = circuit_ids_in_input_order[-1]
        if last_weekend_id in forbidden_ids or not weather.is_feasible(final, last_weekend_id):
            raise BaselineInfeasible(f"no feasible weekend for {final} in baseline order")
        if _would_break_streak(occupied_ids, last_weekend_id, weekends, max_consecutive):
            raise BaselineInfeasible(f"no feasible weekend for {final} in baseline order")
        occupied[last_weekend_id] = final
    return Calendar(weekends=tuple(weekends), assignment=occupied)


def would_break_streak(
    occupied_ids: set[str], candidate: str, weekends: list[RaceWeekend], max_consecutive: int = 3
) -> bool:
    """Public alias for cross-module use (heuristic monthly placement)."""
    return _would_break_streak(occupied_ids, candidate, weekends, max_consecutive)
