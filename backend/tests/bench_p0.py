"""Phase 0 benchmark harness (P0-09): measures problem shape, not solver yet.

Reports per N in {20,22,24}: weekends, feasible cells, distance-matrix stats,
baseline distance (greedy). Phase 1 appends solver wall-time/objective/gap.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend" / "src"))

from ecorace.analytics.baseline import build_baseline
from ecorace.analytics.distance import haversine_km
from ecorace.domain.calendar.weekend import season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
IDS = load_circuit_ids(ROOT / "data" / "circuits.json")


def run_case(n: int, year: int = 2026, repeats: int = 3) -> dict:
    weekends = list(season_weekends(year))
    order = IDS[:n]
    feasible_cells = sum(1 for c in order for w in weekends if WEATHER.is_feasible(c, w.id))
    dists = [
        haversine_km(CIRCUITS[a].latitude, CIRCUITS[a].longitude, CIRCUITS[b].latitude, CIRCUITS[b].longitude)
        for a in order
        for b in order
        if a != b
    ]
    base_times, base_km = [], None
    for _ in range(repeats):
        t0 = time.perf_counter()
        cal = build_baseline(order, weekends, WEATHER)
        base_times.append((time.perf_counter() - t0) * 1000)
        seq = sorted(cal.assignment.items())
        pts = [(CIRCUITS[c].latitude, CIRCUITS[c].longitude) for _, c in seq]
        base_km = sum(haversine_km(*pts[i], *pts[i + 1]) for i in range(len(pts) - 1))
    return {
        "n": n,
        "weekends": len(weekends),
        "feasible_cells": feasible_cells,
        "distance_matrix_min_km": round(min(dists), 2),
        "distance_matrix_max_km": round(max(dists), 2),
        "baseline_km": round(base_km, 2),
        "baseline_ms_p50": round(sorted(base_times)[len(base_times) // 2], 2),
    }


if __name__ == "__main__":
    results = [run_case(n) for n in (20, 22, 24)]
    out = ROOT / "docs" / "BENCHMARK_P0.json"
    out.write_text(json.dumps({"phase": "P0-shape-only", "results": results}, indent=2) + "\n")
    for r in results:
        print(r)
    print(f"wrote {out}")
