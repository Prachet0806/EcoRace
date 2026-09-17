"""P1 gate: solver correctness, determinism, timeout typing, validator independence."""
from pathlib import Path

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.heuristics import HeuristicSolver
from ecorace.optimization.model import SolveStatus, SolverConfig
from ecorace.optimization.pipeline import build_problem, optimize
from ecorace.optimization.validator import SolutionValidator

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
        assert res.status in (SolveStatus.FEASIBLE_OPTIMAL, SolveStatus.FEASIBLE, SolveStatus.FEASIBLE_TIMEOUT), (n, res.status)
        assert res.calendar is not None and res.total_distance_km is not None
        assert res.baseline_distance_km is not None
        assert res.total_distance_km <= res.baseline_distance_km + 1e-6
        assert SolutionValidator.validate(res.calendar, res.calendar and _problem(n).scenario, WEEKENDS, WEATHER) == ()


def test_all_assignments_weather_feasible_and_streak_ok():
    res = optimize(_problem(22), CONFIG)
    assert res.calendar is not None
    for wid, cid in res.calendar.assignment.items():
        assert WEATHER.is_feasible(cid, wid), (cid, wid)
    assert res.calendar.max_streak() <= 3


def test_infeasible_blocked_circuit():
    order = IDS[:20]
    blocked = WeatherPolicy(
        version="t", feasibility={c: {w.id: False for w in WEEKENDS} for c in [order[0]]}, default=True
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
    assert res.status in (SolveStatus.SOLVER_TIMEOUT, SolveStatus.FEASIBLE, SolveStatus.FEASIBLE_TIMEOUT)
    if res.calendar is not None:
        assert SolutionValidator.validate(res.calendar, _problem(24).scenario, WEEKENDS, WEATHER) == ()


def test_heuristic_standalone_valid():
    out, meta = HeuristicSolver().solve(_problem(20), SolverConfig())
    assert out is not None
    cal, _order = out
    assert SolutionValidator.validate(cal, _problem(20).scenario, WEEKENDS, WEATHER) == ()


def test_validator_catches_planted_violations():
    w = list(WEEKENDS)
    dup = Calendar(weekends=WEEKENDS, assignment={w[0].id: "monza", w[1].id: "monza"})
    scen = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026)
    codes = {v.code for v in SolutionValidator.validate(dup, scen, WEEKENDS, WEATHER)}
    assert "DUPLICATE_CIRCUIT" in codes

    four = Calendar(weekends=WEEKENDS, assignment={x.id: f"c{i}" for i, x in enumerate(w[:4])})
    codes = {v.code for v in SolutionValidator.validate(four, scen, WEEKENDS, WEATHER)}
    assert "STREAK_VIOLATION" in codes

    wx = Calendar(weekends=WEEKENDS, assignment={w[0].id: "monza"})  # monza blocked on 2026-03-06
    assert w[0].id == "2026-03-06"
    codes = {v.code for v in SolutionValidator.validate(wx, scen, WEEKENDS, WEATHER)}
    assert "WEATHER_INFEASIBLE" in codes

    short = Calendar(weekends=WEEKENDS, assignment={w[4].id: "monza"})
    codes = {v.code for v in SolutionValidator.validate(short, scen, WEEKENDS, WEATHER)}
    assert "RACE_COUNT_MISMATCH" in codes


def test_horizon_edge_triple_at_end_valid():
    w = list(WEEKENDS)
    cal = Calendar(weekends=WEEKENDS, assignment={w[-3].id: "a", w[-2].id: "b", w[-1].id: "c"})
    assert cal.streak_violations() == []  # no following weekend: break rule vacuous at edge
    assert cal.max_streak() == 3
