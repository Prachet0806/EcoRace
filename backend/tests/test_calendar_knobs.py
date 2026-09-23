"""V1.1 calendar knobs: configurable streak limit, summer break, Dec finale pin."""
from pathlib import Path

import pytest

from ecorace.analytics.baseline import build_baseline
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import (
    InvalidStreakLimit,
    InvalidSummerBreak,
    Scenario,
    validate_scenario,
)
from ecorace.domain.calendar.weekend import season_weekends, summer_break_weekend_ids
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.model import SolveStatus, SolverConfig
from ecorace.optimization.pipeline import build_problem, optimize
from ecorace.optimization.validator import SolutionValidator

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
IDS = load_circuit_ids(ROOT / "data" / "circuits.json")
WEEKENDS = season_weekends(2026)


def _run_cal(length: int, start: int = 0) -> Calendar:
    w = list(WEEKENDS)
    return Calendar(weekends=WEEKENDS, assignment={x.id: f"c{i}" for i, x in enumerate(w[start : start + length])})


def test_streak_limit_parameterized():
    assert _run_cal(2).streak_violations(2) == []
    assert len(_run_cal(3).streak_violations(2)) == 1
    assert _run_cal(4).streak_violations(4) == []
    assert len(_run_cal(5).streak_violations(4)) == 1
    assert _run_cal(1).streak_violations(1) == []
    assert len(_run_cal(2).streak_violations(1)) == 1
    # Default stays 3 (backward compatible).
    assert _run_cal(3).streak_violations() == []
    assert len(_run_cal(4).streak_violations()) == 1


def test_scenario_knob_validation():
    base = {"race_count": 20, "circuit_ids": tuple(IDS[:20]), "season_year": 2026}
    validate_scenario(Scenario(**base, max_consecutive=2), set(CIRCUITS))
    validate_scenario(Scenario(**base, max_consecutive=7), set(CIRCUITS))
    with pytest.raises(InvalidStreakLimit):
        validate_scenario(Scenario(**base, max_consecutive=1), set(CIRCUITS))
    with pytest.raises(InvalidStreakLimit):
        validate_scenario(Scenario(**base, max_consecutive=8), set(CIRCUITS))
    with pytest.raises(InvalidSummerBreak):
        validate_scenario(Scenario(**base, summer_break_start=19), set(CIRCUITS))
    with pytest.raises(InvalidSummerBreak):
        validate_scenario(Scenario(**base, summer_break_start=21, summer_break_end=19), set(CIRCUITS))
    validate_scenario(Scenario(**base, summer_break_start=19, summer_break_end=21), set(CIRCUITS))


def test_summer_break_resolution_clamped():
    s = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026,
                 summer_break_start=19, summer_break_end=21)
    ids = summer_break_weekend_ids(s, WEEKENDS)
    assert ids == frozenset([WEEKENDS[19].id, WEEKENDS[20].id, WEEKENDS[21].id])
    s2 = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026)
    assert summer_break_weekend_ids(s2, WEEKENDS) == frozenset()


def test_validator_summer_and_pin_violations():
    w = list(WEEKENDS)
    s = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026,
                 summer_break_start=0, summer_break_end=0, pin_end_to_dec_week1=True)
    cal = Calendar(weekends=WEEKENDS, assignment={w[0].id: IDS[0], w[-2].id: IDS[1]})
    codes = {v.code for v in SolutionValidator.validate(cal, s, WEEKENDS, WEATHER)}
    assert "SUMMER_BREAK_VIOLATION" in codes
    assert "DEC_PIN_VIOLATION" in codes


def test_validator_monthly_minimum():
    w = list(WEEKENDS)
    s = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026)
    # Races only in March → every other month uncovered.
    cal = Calendar(weekends=WEEKENDS, assignment={w[0].id: IDS[0], w[1].id: IDS[1]})
    codes = [v.code for v in SolutionValidator.validate(cal, s, WEEKENDS, WEATHER)]
    assert "MONTHLY_MINIMUM_VIOLATION" in codes
    # Full-horizon spread passes.
    seen_months: set[int] = set()
    spread: dict[str, str] = {}
    for i, x in enumerate(w):
        if x.friday.month not in seen_months:
            seen_months.add(x.friday.month)
            spread[x.id] = IDS[len(spread)]
    for i, x in enumerate(w):
        if len(spread) >= 20:
            break
        spread.setdefault(x.id, IDS[len(spread)])
    full = Calendar(weekends=WEEKENDS, assignment=spread)
    assert "MONTHLY_MINIMUM_VIOLATION" not in {v.code for v in SolutionValidator.validate(full, s, WEEKENDS, WEATHER)}
    # Break-touched months are exempt.
    sb = Scenario(race_count=20, circuit_ids=tuple(IDS[:20]), season_year=2026,
                  summer_break_start=0, summer_break_end=39)
    exempt = {v.code for v in SolutionValidator.validate(cal, sb, WEEKENDS, WEATHER)}
    assert "MONTHLY_MINIMUM_VIOLATION" not in exempt


def test_baseline_honors_knobs():
    order = IDS[:20]
    cal = build_baseline(order, list(WEEKENDS), WEATHER, max_consecutive=2)
    assert cal.max_streak() <= 2
    cal = build_baseline(order, list(WEEKENDS), WEATHER, max_consecutive=2,
                         forbidden_ids=frozenset([w.id for w in WEEKENDS[:10]]),
                         last_weekend_id=WEEKENDS[-1].id)
    assert WEEKENDS[-1].id in cal.assignment
    assert not any(wid in [w.id for w in WEEKENDS[:10]] for wid in cal.assignment)


def test_pipeline_combined_knobs_feasible():
    scen = Scenario(
        race_count=20,
        circuit_ids=tuple(IDS[:20]),
        season_year=2026,
        max_consecutive=2,
        summer_break_start=19,
        summer_break_end=21,
        pin_end_to_dec_week1=True,
    )
    prob = build_problem(scen, CIRCUITS, WEEKENDS, WEATHER, data_version="test")
    res = optimize(prob, SolverConfig(time_limit_s=3.0, seed=0))
    assert res.status in (SolveStatus.FEASIBLE_OPTIMAL, SolveStatus.FEASIBLE, SolveStatus.FEASIBLE_TIMEOUT)
    assert res.calendar is not None
    assert SolutionValidator.validate(res.calendar, scen, WEEKENDS, WEATHER) == ()
    assert res.calendar.max_streak() <= 2
    assert WEEKENDS[-1].id in res.calendar.assignment
    break_ids = {WEEKENDS[i].id for i in (19, 20, 21)}
    assert not (set(res.calendar.assignment) & break_ids)
    from ecorace.domain.calendar.weekend import covered_months

    covered = set(covered_months(list(WEEKENDS), frozenset(break_ids)))
    occupied = {w.friday.month for w in WEEKENDS if w.id in res.calendar.assignment}
    assert covered <= occupied
