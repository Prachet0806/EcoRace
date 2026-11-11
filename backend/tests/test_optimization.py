"""P1 gate: solver correctness, determinism, timeout typing, validator independence."""

import random
import time
from pathlib import Path

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization import pipeline
from ecorace.optimization.heuristics import (
    HeuristicSolver,
    nearest_neighbor,
    place_with_monthly_cover,
    two_opt,
)
from ecorace.optimization.model import (
    SolverConfig,
    SolveStatus,
    build_distance_matrix,
    order_distance_km,
)
from ecorace.optimization.ortools_solver import (
    _progress_timing,
    _SolutionTiming,
    _status_without_solution,
)
from ecorace.optimization.pipeline import build_problem, optimize
from ecorace.optimization.quality import route_quality
from ecorace.optimization.validator import SolutionValidator
from ortools.sat.python import cp_model

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
IDS = load_circuit_ids(ROOT / "data" / "circuits.json")
WEEKENDS = season_weekends(2026)
CONFIG = SolverConfig(time_limit_s=3.0, seed=0)


def _problem(n: int, weather: WeatherPolicy = WEATHER) -> object:
    return build_problem(
        Scenario(race_count=n, circuit_ids=tuple(IDS[:n]), season_year=2026),
        CIRCUITS,
        WEEKENDS,
        weather,
        data_version="test",
    )


def test_pipeline_feasible_and_beats_baseline():
    for n in (20, 22, 24):
        res = optimize(_problem(n), CONFIG)
        assert res.status in (
            SolveStatus.FEASIBLE_OPTIMAL,
            SolveStatus.FEASIBLE,
            SolveStatus.FEASIBLE_TIMEOUT,
        ), (n, res.status)
        assert res.calendar is not None and res.total_distance_km is not None
        assert res.baseline_distance_km is not None
        # Guardrail: optimized must never regress vs a COMPARABLE baseline.
        # A non_comparable baseline (e.g. monthly-minimum violation) is a
        # reference lower bound, so no <= assertion applies to it.
        if res.diagnostics.get("baseline_status") == "ok":
            assert res.total_distance_km <= res.baseline_distance_km + 1e-6
            assert res.diagnostics.get("origin") in ("baseline", "heuristic", "ortools")
        else:
            assert res.diagnostics.get("baseline_status", "").startswith(
                ("non_comparable", "infeasible")
            )
        assert (
            SolutionValidator.validate(
                res.calendar, res.calendar and _problem(n).scenario, WEEKENDS, WEATHER
            )
            == ()
        )


def test_baseline_status_flags_monthly_violation():
    # Greedy input-order baseline packs early weekends and skips the
    # monthly-minimum rule, so its status must NOT be reported as "ok".
    res = optimize(_problem(20), CONFIG)
    assert res.diagnostics.get("baseline_status", "").startswith(
        "non_comparable:MONTHLY_MINIMUM_VIOLATION"
    )


def test_all_assignments_weather_feasible_and_streak_ok():
    res = optimize(_problem(22), CONFIG)
    assert res.calendar is not None
    for wid, cid in res.calendar.assignment.items():
        assert WEATHER.is_feasible(cid, wid), (cid, wid)
    assert res.calendar.max_streak() <= 3


def test_infeasible_blocked_circuit():
    order = IDS[:20]
    blocked = WeatherPolicy(
        version="t",
        feasibility={c: {w.id: False for w in WEEKENDS} for c in [order[0]]},
        default=True,
    )
    try:
        prob = _problem(20, blocked)
    except Exception as e:
        assert type(e).__name__ == "InfeasibleProblem"
        return
    res = optimize(prob, CONFIG)
    assert res.status == SolveStatus.INFEASIBLE
    assert res.calendar is None


def test_seed_determinism():
    r1 = optimize(_problem(20), SolverConfig(time_limit_s=2.0, seed=42))
    r2 = optimize(_problem(20), SolverConfig(time_limit_s=2.0, seed=42))
    assert r1.total_distance_km == r2.total_distance_km
    assert r1.calendar.assignment == r2.calendar.assignment


def test_timeout_is_typed_never_fake():
    res = optimize(_problem(24), SolverConfig(time_limit_s=0.0, seed=0))
    assert res.status in (
        SolveStatus.SOLVER_TIMEOUT,
        SolveStatus.FEASIBLE,
        SolveStatus.FEASIBLE_TIMEOUT,
    )
    if res.calendar is not None:
        assert (
            SolutionValidator.validate(
                res.calendar, _problem(24).scenario, WEEKENDS, WEATHER
            )
            == ()
        )


def test_cp_sat_diagnostics_distinguish_invalid_model_and_presolve():
    assert _status_without_solution(cp_model.MODEL_INVALID) == SolveStatus.SOLVER_FAILURE
    assert _status_without_solution(cp_model.UNKNOWN) == SolveStatus.SOLVER_TIMEOUT
    assert _progress_timing("Starting presolve at 0.02s\nStarting search at 1.25s") == {
        "search_started": True,
        "presearch_ms": 1250,
        "presolve_estimate_ms": 1230,
    }
    assert _progress_timing("Starting presolve at 0.02s") == {
        "search_started": False,
        "presearch_ms": None,
        "presolve_estimate_ms": None,
    }


def test_solution_timing_callback_observes_first_incumbent():
    model = cp_model.CpModel()
    choice = model.NewBoolVar("choice")
    model.Minimize(choice)
    solver = cp_model.CpSolver()
    started = time.perf_counter()
    callback = _SolutionTiming(started)
    assert solver.Solve(model, callback) == cp_model.OPTIMAL
    assert callback.count >= 1
    assert callback.first_ms is not None and callback.first_ms >= 0
    assert callback.first_km == 0.0


def test_expired_deadline_does_not_start_cp_sat(monkeypatch):
    def unexpected_solve(*args, **kwargs):
        raise AssertionError("CP-SAT started after the end-to-end deadline")

    monkeypatch.setattr(pipeline.ORToolsSolver, "solve", unexpected_solve)
    res = optimize(
        _problem(20),
        SolverConfig(time_limit_s=9, seed=7, deadline_monotonic=time.monotonic() - 1),
    )
    assert res.status == SolveStatus.SOLVER_TIMEOUT


def test_heuristic_standalone_valid():
    out, meta = HeuristicSolver().solve(_problem(20), SolverConfig())
    assert out is not None
    cal, _order = out
    assert (
        SolutionValidator.validate(cal, _problem(20).scenario, WEEKENDS, WEATHER) == ()
    )


def test_validator_catches_planted_violations():
    w = list(WEEKENDS)
    dup = Calendar(weekends=WEEKENDS, assignment={w[0].id: "monza", w[1].id: "monza"})
    scen = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026)
    codes = {v.code for v in SolutionValidator.validate(dup, scen, WEEKENDS, WEATHER)}
    assert "DUPLICATE_CIRCUIT" in codes

    four = Calendar(
        weekends=WEEKENDS, assignment={x.id: f"c{i}" for i, x in enumerate(w[:4])}
    )
    codes = {v.code for v in SolutionValidator.validate(four, scen, WEEKENDS, WEATHER)}
    assert "STREAK_VIOLATION" in codes

    wx = Calendar(
        weekends=WEEKENDS, assignment={w[0].id: "monza"}
    )  # monza blocked on 2026-03-06
    assert w[0].id == "2026-03-06"
    codes = {v.code for v in SolutionValidator.validate(wx, scen, WEEKENDS, WEATHER)}
    assert "WEATHER_INFEASIBLE" in codes

    short = Calendar(weekends=WEEKENDS, assignment={w[4].id: "monza"})
    codes = {v.code for v in SolutionValidator.validate(short, scen, WEEKENDS, WEATHER)}
    assert "RACE_COUNT_MISMATCH" in codes


def test_horizon_edge_triple_at_end_valid():
    w = list(WEEKENDS)
    cal = Calendar(
        weekends=WEEKENDS, assignment={w[-3].id: "a", w[-2].id: "b", w[-1].id: "c"}
    )
    assert (
        cal.streak_violations() == []
    )  # no following weekend: break rule vacuous at edge
    assert cal.max_streak() == 3


def test_monthly_cover_preserves_tour_locality():
    # Regression: scattering the TSP tour head one-per-month across the
    # season more than doubled routed distance (122,820 km placed vs a
    # ~50,000 km tour on 24 races). Contiguous chunks per covered month
    # must keep placed distance near the input tour distance.
    order = IDS[:24]
    matrix = build_distance_matrix(CIRCUITS, order)
    tour = [order[i] for i in two_opt(nearest_neighbor(order, matrix, 0), matrix)]
    tour_km = order_distance_km(tour, CIRCUITS)
    cal = place_with_monthly_cover(tour, list(WEEKENDS), WEATHER, 3, frozenset(), None)
    placed = [cal.assignment[w.id] for w in WEEKENDS if w.id in cal.assignment]
    assert placed != []
    assert order_distance_km(placed, CIRCUITS) <= tour_km * 1.05
    scen = Scenario(race_count=24, circuit_ids=tuple(order), season_year=2026)
    assert SolutionValidator.validate(cal, scen, WEEKENDS, WEATHER) == ()


def test_operational_route_quality_regression():
    official = [cid for cid in IDS if CIRCUITS[cid].f1_current_2026]
    cases = [IDS[:24], official, random.Random(29).sample(IDS, 24)]
    for ids in cases:
        problem = build_problem(
            Scenario(race_count=24, circuit_ids=tuple(ids), season_year=2026),
            CIRCUITS, WEEKENDS, WEATHER, data_version="quality-test",
        )
        output, _ = HeuristicSolver().solve(problem, SolverConfig(time_limit_s=3, seed=0))
        assert output is not None
        calendar, _ = output
        assert SolutionValidator.validate(calendar, problem.scenario, WEEKENDS, WEATHER) == ()
        measures = route_quality(pipeline.race_order(calendar), CIRCUITS)
        assert measures["region_backtracks"] == 0
        assert measures["hops_over_5000_km"] <= 5
        assert measures["longest_hop_km"] < 10000


def test_regional_repair_removes_measured_reentry_with_bounded_distance():
    ids = random.Random(1).sample(IDS, 24)
    problem = build_problem(
        Scenario(race_count=24, circuit_ids=tuple(ids), season_year=2026),
        CIRCUITS, WEEKENDS, WEATHER, data_version="regional-regression",
    )
    output, _ = HeuristicSolver().solve(problem, SolverConfig(time_limit_s=3, seed=0))
    assert output is not None
    calendar, _ = output
    assert SolutionValidator.validate(calendar, problem.scenario, WEEKENDS, WEATHER) == ()
    measures = route_quality(pipeline.race_order(calendar), CIRCUITS)
    assert measures["region_backtracks"] == 0
    assert order_distance_km(pipeline.race_order(calendar), CIRCUITS) <= 43471.64 * 1.02
    selected = optimize(problem, SolverConfig(time_limit_s=0, seed=0))
    tradeoff = selected.diagnostics["quality_selection"]
    assert tradeoff["region_backtracks"] == 0
    assert 1.0 < tradeoff["selected_extra_distance_pct"] <= 2.0
