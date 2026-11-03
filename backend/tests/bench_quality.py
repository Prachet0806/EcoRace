"""Compare validated heuristic and CP-SAT calendars on representative venue sets.

Run from the repository root with Python 3.11:
    python backend/tests/bench_quality.py --budget 5

Prints JSON only. No benchmark result is written into the source tree.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.heuristics import HeuristicSolver
from ecorace.optimization.model import SolverConfig, order_distance_km
from ecorace.optimization.quality import route_quality
from ecorace.optimization.ortools_solver import ORToolsSolver
from ecorace.optimization.pipeline import build_problem, race_order
from ecorace.optimization.validator import SolutionValidator

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
ALL_IDS = load_circuit_ids(ROOT / "data" / "circuits.json")
OFFICIAL_IDS = [cid for cid in ALL_IDS if CIRCUITS[cid].f1_current_2026]
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
WEEKENDS = season_weekends(2026)


def quality(calendar) -> dict:
    ids = race_order(calendar)
    return {
        "total_km": round(order_distance_km(ids, CIRCUITS), 2),
        **route_quality(ids, CIRCUITS),
    }


def run_case(label: str, ids: list[str], budget_s: float) -> dict:
    problem = build_problem(
        Scenario(race_count=len(ids), circuit_ids=tuple(ids), season_year=2026),
        CIRCUITS, WEEKENDS, WEATHER, data_version="quality-benchmark",
    )
    results = {"case": label, "race_count": len(ids), "budget_s": budget_s}
    heuristic_start = time.monotonic()
    h_out, h_meta = HeuristicSolver().solve(
        problem,
        SolverConfig(time_limit_s=budget_s, seed=0, deadline_monotonic=heuristic_start + budget_s),
    )
    h_cal = h_out[0] if h_out else None
    results["heuristic"] = {
        "status": h_meta.status.value,
        "runtime_ms": int((time.monotonic() - heuristic_start) * 1000),
        "violations": len(SolutionValidator.validate(h_cal, problem.scenario, WEEKENDS, WEATHER)) if h_cal else None,
        **(quality(h_cal) if h_cal else {}),
    }
    ortools_start = time.monotonic()
    o_cal, o_meta = ORToolsSolver().solve(
        problem,
        SolverConfig(time_limit_s=budget_s, seed=0, deadline_monotonic=ortools_start + budget_s, presolve=True),
        hint_calendar=h_cal,
    )
    results["ortools"] = {
        "status": o_meta.status.value,
        "runtime_ms": int((time.monotonic() - ortools_start) * 1000),
        "violations": len(SolutionValidator.validate(o_cal, problem.scenario, WEEKENDS, WEATHER)) if o_cal else None,
        **(quality(o_cal) if o_cal else {}),
    }
    return results


def probe_mixed_sets(count: int) -> list[dict]:
    """Find deterministic mixed-region inputs with the worst travel pattern."""
    rows = []
    for seed in range(count):
        ids = random.Random(seed).sample(ALL_IDS, 24)
        problem = build_problem(
            Scenario(race_count=24, circuit_ids=tuple(ids), season_year=2026),
            CIRCUITS, WEEKENDS, WEATHER, data_version="quality-probe",
        )
        output, meta = HeuristicSolver().solve(problem, SolverConfig(time_limit_s=3, seed=0))
        if output is None:
            rows.append({"seed": seed, "status": meta.status.value})
            continue
        calendar, _ = output
        rows.append({
            "seed": seed,
            "violations": len(SolutionValidator.validate(calendar, problem.scenario, WEEKENDS, WEATHER)),
            **quality(calendar),
        })
    return sorted(
        rows,
        key=lambda row: (row.get("region_backtracks", -1), row.get("hops_over_5000_km", -1), row.get("total_km", -1)),
        reverse=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget", type=float, default=5.0)
    parser.add_argument("--probe-seeds", type=int, default=0)
    args = parser.parse_args()
    if args.budget <= 0:
        parser.error("--budget must be positive")
    if args.probe_seeds < 0:
        parser.error("--probe-seeds cannot be negative")
    if args.probe_seeds:
        print(json.dumps(probe_mixed_sets(args.probe_seeds), indent=2))
        raise SystemExit(0)
    cases = {
        "catalog_first_20": ALL_IDS[:20],
        "catalog_first_24": ALL_IDS[:24],
        "official_2026_first_20": OFFICIAL_IDS[:20],
        "official_2026_all_24": OFFICIAL_IDS,
        "mixed_seed_7_20": random.Random(7).sample(ALL_IDS, 20),
        "mixed_seed_29_24": random.Random(29).sample(ALL_IDS, 24),
    }
    print(json.dumps([run_case(name, ids, args.budget) for name, ids in cases.items()], indent=2))
