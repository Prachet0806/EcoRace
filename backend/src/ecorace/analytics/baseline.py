"""Deterministic baseline (P0-07): input order -> earliest feasible weekend.

Respects: occupancy (one/weekend), weather, streak<=3 (incl. break-after-3 edge).
Raises BaselineInfeasible if greedy placement fails. Greedy failure does NOT
imply scenario infeasibility (documented contract).
"""
from __future__ import annotations

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.weekend import RaceWeekend
from ecorace.domain.constraints.weather import WeatherPolicy


class BaselineInfeasible(Exception):
    code = "BASELINE_INFEASIBLE"


def _would_break_streak(occupied_ids: set[str], candidate: str, weekends: list[RaceWeekend]) -> bool:
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
        if run > 3:
            return True
        prev = idx[wid]
    return False


def build_baseline(
    circuit_ids_in_input_order: list[str],
    weekends: list[RaceWeekend],
    weather: WeatherPolicy,
) -> Calendar:
    occupied: dict[str, str] = {}
    occupied_ids: set[str] = set()
    for circuit_id in circuit_ids_in_input_order:
        placed = False
        for w in weekends:
            if w.id in occupied:
                continue
            if not weather.is_feasible(circuit_id, w.id):
                continue
            if _would_break_streak(occupied_ids, w.id, weekends):
                continue
            occupied[w.id] = circuit_id
            occupied_ids.add(w.id)
            placed = True
            break
        if not placed:
            raise BaselineInfeasible(f"no feasible weekend for {circuit_id} in baseline order")
    return Calendar(weekends=tuple(weekends), assignment=occupied)
