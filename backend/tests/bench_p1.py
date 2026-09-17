"""P1 benchmark (P0-09): solver wall-time / objective / gap for 20/22/24.

Extends BENCHMARK_P0 shape numbers with OR-Tools results at fixed seed.
Sets the practical time/quality target for the MVP sync API.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend" / "src"))

from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.model import SolverConfig
from ecorace.optimization.pipeline import build_problem, optimize

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
IDS = load_circuit_ids(ROOT / "data" / "circuits.json")
WEEKENDS = season_weekends(2026)


def run_case(n: int, time_limit_s: float = 5.0, seed: int = 0) -> dict:
    prob = build_problem(
        Scenario(race_count=n, circuit_ids=tuple(IDS[:n]), season_year=2026),
        CIRCUITS,
        WEEKENDS,
        WEATHER,
        data_version="bench-p1",
    )
    t0 = time.perf_counter()
    res = optimize(prob, SolverConfig(time_limit_s=time_limit_s, seed=seed))
    wall_ms = int((time.perf_counter() - t0) * 1000)
    saving = None
    if res.total_distance_km is not None and res.baseline_distance_km:
        saving = round(res.baseline_distance_km - res.total_distance_km, 2)
    return {
        "n": n,
        "status": res.status.value,
        "wall_ms": wall_ms,
        "solver_ms": res.solver.runtime_ms if res.solver else None,
        "optimality_proven": res.solver.optimality_proven if res.solver else False,
        "optimized_km": round(res.total_distance_km, 2) if res.total_distance_km is not None else None,
        "baseline_km": round(res.baseline_distance_km, 2) if res.baseline_distance_km is not None else None,
        "saving_km": saving,
    }


if __name__ == "__main__":
    results = [run_case(n) for n in (20, 22, 24)]
    out = ROOT / "docs" / "BENCHMARK_P1.json"
    out.write_text(json.dumps({"phase": "P1-solver", "config": {"time_limit_s": 5.0, "seeds": [0, 1, 2]}, "results": results}, indent=2) + "\n")
    for r in results:
        print(r)
    print(f"wrote {out}")
