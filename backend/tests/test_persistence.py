"""Migration, transaction, and foreign-key behavior for saved runs."""

import sqlite3

import pytest
from ecorace.infrastructure import persistence


def _scenario(scenario_id="scn_test"):
    return {
        "scenario_id": scenario_id,
        "race_count": 20,
        "circuit_ids": [f"c{i}" for i in range(20)],
        "season_year": 2026,
        "weekend_count": 40,
        "horizon": {"start": "2026-03-06", "end": "2026-12-04"},
        "max_consecutive": 2,
        "summer_break_start": 19,
        "summer_break_end": 21,
        "pin_end_to_dec_week1": True,
    }


def _run(run_id="run_test", scenario_id="scn_test"):
    return {
        "run_id": run_id,
        "scenario_id": scenario_id,
        "status": "feasible",
        "season_year": 2026,
        "calendar": {"race_count": 20},
        "segments": [],
        "metrics": {},
        "constraints": [],
        "solver": {},
        "data_version": "test",
        "provenance": {"weather_version": "weather-v1"},
    }


def test_complete_scenario_run_transaction_and_cascade(tmp_path, monkeypatch):
    monkeypatch.setattr(persistence, "DB_PATH", str(tmp_path / "runs.db"))
    persistence.init_db()
    persistence.save_scenario_and_run(_scenario(), _run())
    stored = persistence.get_scenario("scn_test")
    assert stored["config_complete"] is True
    assert stored["max_consecutive"] == 2
    assert stored["pin_end_to_dec_week1"] is True
    assert (
        persistence.get_run("run_test")["provenance"]["weather_version"] == "weather-v1"
    )
    with pytest.raises(sqlite3.IntegrityError):
        persistence.save_scenario_and_run(_scenario("scn_rolled_back"), _run())
    assert persistence.get_scenario("scn_rolled_back") is None
    assert persistence.delete_scenario("scn_test") is True
    assert persistence.get_run("run_test") is None


def test_legacy_scenario_is_marked_incomplete(tmp_path, monkeypatch):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as conn:
        conn.executescript("""
            CREATE TABLE scenarios (id TEXT PRIMARY KEY, race_count INTEGER NOT NULL,
              circuit_ids TEXT NOT NULL, season_year INTEGER NOT NULL, weekend_count INTEGER NOT NULL,
              horizon_start TEXT NOT NULL, horizon_end TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            INSERT INTO scenarios (id, race_count, circuit_ids, season_year, weekend_count,
              horizon_start, horizon_end) VALUES ('scn_old', 20, '[]', 2026, 40,
              '2026-03-06', '2026-12-04');
        """)
    monkeypatch.setattr(persistence, "DB_PATH", str(path))
    persistence.init_db()
    stored = persistence.get_scenario("scn_old")
    assert stored["config_complete"] is False
    assert stored["max_consecutive"] is None
