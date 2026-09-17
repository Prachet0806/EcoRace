"""P0 gate: 20/22/24 validation, insufficient/excess/duplicate/unknown, weather, streaks, uniqueness."""
from pathlib import Path

import pytest

from ecorace.analytics.baseline import BaselineInfeasible, build_baseline
from ecorace.analytics.distance import haversine_km
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import (
    DuplicateCircuit,
    ExcessCircuits,
    InsufficientCircuits,
    InvalidRaceCount,
    Scenario,
    UnknownCircuit,
    validate_scenario,
)
from ecorace.domain.calendar.weekend import RaceWeekend, season_weekends
from ecorace.domain.circuit.models import load_circuit_ids, load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy

ROOT = Path(__file__).resolve().parents[2]
CIRCUITS = load_circuits(ROOT / "data" / "circuits.json")
WEATHER = WeatherPolicy.from_json(ROOT / "data" / "weather" / "weather-v1.json")
IDS24 = load_circuit_ids(ROOT / "data" / "circuits.json")


def test_circuit_library_has_24_unique():
    assert len(CIRCUITS) >= 24
    assert len(set(CIRCUITS)) == len(CIRCUITS)


def test_scenario_exact_match_20_22_24():
    for n in (20, 22, 24):
        s = validate_scenario(Scenario(race_count=n, circuit_ids=tuple(IDS24[:n]), season_year=2026), set(CIRCUITS))
        assert s.race_count == n


def test_insufficient_excess_duplicate_unknown_race_count():
    with pytest.raises(InsufficientCircuits):
        validate_scenario(Scenario(race_count=22, circuit_ids=tuple(IDS24[:20]), season_year=2026), set(CIRCUITS))
    with pytest.raises(ExcessCircuits):
        validate_scenario(Scenario(race_count=20, circuit_ids=tuple(IDS24[:22]), season_year=2026), set(CIRCUITS))
    with pytest.raises(DuplicateCircuit):
        validate_scenario(Scenario(race_count=20, circuit_ids=tuple([IDS24[0]] * 20), season_year=2026), set(CIRCUITS))
    with pytest.raises(UnknownCircuit):
        validate_scenario(
            Scenario(race_count=20, circuit_ids=tuple(["nope"] + IDS24[1:20]), season_year=2026), set(CIRCUITS)
        )
    with pytest.raises(InvalidRaceCount):
        validate_scenario(Scenario(race_count=19, circuit_ids=tuple(IDS24[:19]), season_year=2026), set(CIRCUITS))


def test_weather_fixture_cells():
    assert WEATHER.is_feasible("monza", "2026-04-03") is True
    assert WEATHER.is_feasible("monza", "2026-03-06") is False
    assert WEATHER.is_feasible("spa", "2026-03-06") is False


def test_weather_forbidden_scheduling_detected():
    weekends = list(season_weekends(2026))
    cal = Calendar(weekends=tuple(weekends), assignment={weekends[0].id: "monza"})
    assert WEATHER.is_feasible("monza", weekends[0].id) is False  # forbidden cell occupied


def _cal_with_run(length: int) -> Calendar:
    weekends = list(season_weekends(2026))[:6]
    return Calendar(weekends=tuple(weekends), assignment={w.id: f"c{i}" for i, w in enumerate(weekends[:length])})


def test_max_3_consecutive_ok_and_4_violates():
    assert _cal_with_run(3).streak_violations() == []
    assert _cal_with_run(3).max_streak() == 3
    assert len(_cal_with_run(4).streak_violations()) == 1


def test_one_race_per_weekend_and_uniqueness():
    weekends = list(season_weekends(2026))
    dup = Calendar(weekends=tuple(weekends), assignment={weekends[0].id: "monza", weekends[1].id: "monza"})
    assert any(code == "DUPLICATE_CIRCUIT" for _, code, _ in dup.structural_violations())


def test_haversine_properties():
    assert haversine_km(45.6, 9.28, 45.6, 9.28) == pytest.approx(0.0)
    a = haversine_km(45.6156, 9.28111, 52.0786, -1.01694)  # monza-silverstone
    b = haversine_km(52.0786, -1.01694, 45.6156, 9.28111)
    assert a == pytest.approx(b)
    assert 900 < a < 1200  # ~1,020 km corridor
    assert a >= 0


def test_baseline_determinism_and_infeasibility():
    weekends = list(season_weekends(2026))
    order = IDS24[:20]
    b1 = build_baseline(order, weekends, WEATHER)
    b2 = build_baseline(order, weekends, WEATHER)
    assert b1.assignment == b2.assignment
    assert b1.race_count() == 20
    assert b1.streak_violations() == []
    # Fully-blocked circuit forces BASELINE_INFEASIBLE (greedy), per contract
    blocked = WeatherPolicy(version="t", feasibility={c: {w.id: False for w in weekends} for c in order}, default=True)
    with pytest.raises(BaselineInfeasible):
        build_baseline(order, weekends, blocked)


def test_venue_union_grade1_plus_f1_2020_onwards():
    import json as _json

    raw = _json.loads((ROOT / "data" / "circuits.json").read_text(encoding="utf-8"))
    assert raw["dataset_version"] == "fia-grade1-2026-03-31+f1-2020-2026"
    entries = raw["circuits"]
    assert len(entries) == len(CIRCUITS) == 42
    coords = [(e["latitude"], e["longitude"]) for e in entries]
    assert len(set(coords)) == len(coords)  # one routing node per physical venue
    f1_only = [e for e in entries if e.get("venue_source") == "f1_calendar"]
    assert {e["id"] for e in f1_only} == {"sochi", "istanbul", "suzuka", "shanghai", "austin", "mexico_city", "madring"}
    # Grade comes from the transmitted March list, except madring (verified
    # 2026-06-23 post-list homologation — see data notes).
    assert {e["id"] for e in f1_only if e.get("fia_license_grade") is None} == {
        "sochi", "istanbul", "suzuka", "shanghai", "austin", "mexico_city",
    }
    for e in f1_only:
        assert e["f1_hosted_seasons"] and min(e["f1_hosted_seasons"]) >= 2020 and max(e["f1_hosted_seasons"]) <= 2026
    hosted_2026 = {e["id"] for e in entries if e.get("f1_current_2026")}
    assert {"suzuka", "shanghai", "austin", "mexico_city", "madring"} <= hosted_2026
    assert not ({"sochi", "istanbul"} & hosted_2026)


def test_weekend_id_is_friday_date():
    w = season_weekends(2026)[0]
    assert isinstance(w, RaceWeekend) and w.id == w.friday.isoformat()
