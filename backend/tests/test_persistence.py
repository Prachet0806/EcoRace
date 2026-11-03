"""Migration, transaction, and foreign-key behavior for saved runs."""

import sqlite3
import sys
import uuid

import pytest
from ecorace.infrastructure import db_admin, persistence


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
    assert list(tmp_path.glob(f"legacy.db.pre-v{persistence.SCHEMA_VERSION}-*.db"))
    assert db_admin.inspect_database(path)["schema_version"] == persistence.SCHEMA_VERSION


def test_backup_and_migrate_preserve_committed_runs(tmp_path, monkeypatch):
    source = tmp_path / "source.db"
    monkeypatch.setattr(persistence, "DB_PATH", str(source))
    persistence.init_db()
    persistence.save_scenario_and_run(_scenario(), _run())

    backup = tmp_path / "backup.db"
    persistence.backup_database(source, backup)
    copied = db_admin.inspect_database(backup)
    assert copied["integrity"] == "ok"
    assert (copied["scenarios"], copied["runs"]) == (1, 1)

    migrated = db_admin.migrate_database(backup, tmp_path / "migrated.db")
    assert (migrated["scenarios"], migrated["runs"]) == (1, 1)
    assert migrated["schema_version"] == persistence.SCHEMA_VERSION
    assert db_admin.inspect_database(source)["runs"] == 1
    monkeypatch.setattr(sys, "argv", ["db_admin", "check", str(source), "--strict"])
    db_admin.main()


def test_required_mount_rejects_ephemeral_path(tmp_path, monkeypatch):
    monkeypatch.setattr(persistence, "DB_PATH", str(tmp_path / "runs.db"))
    monkeypatch.setenv("ECORACE_REQUIRE_PERSISTENT_DB", "1")
    monkeypatch.setenv("ECORACE_DB_MOUNT", str(tmp_path))
    with pytest.raises(RuntimeError, match="refusing ephemeral storage"):
        persistence.init_db()
    assert not (tmp_path / "runs.db").exists()


def test_quota_is_durable_and_scoped(tmp_path, monkeypatch):
    monkeypatch.setattr(persistence, "DB_PATH", str(tmp_path / "quota.db"))
    persistence.init_db()
    assert persistence.consume_quota("client:runs", 2, 60)[0] is True
    assert persistence.consume_quota("client:runs", 2, 60)[0] is True
    allowed, retry_after = persistence.consume_quota("client:runs", 2, 60)
    assert allowed is False and 1 <= retry_after <= 60
    assert persistence.consume_quota("other:runs", 2, 60)[0] is True


def test_submission_recovery_and_atomic_result_commit(tmp_path, monkeypatch):
    monkeypatch.setattr(persistence, "DB_PATH", str(tmp_path / "submissions.db"))
    persistence.init_db()
    key = str(uuid.uuid4())
    assert persistence.claim_submission(key, "hash-a") == ("claimed", None)
    assert persistence.claim_submission(key, "hash-a") == ("running", None)
    assert persistence.claim_submission(key, "hash-b") == ("conflict", None)
    persistence.interrupt_running_submissions()
    assert persistence.get_submission(key) == {"status": "interrupted", "run_id": None}
    assert persistence.claim_submission(key, "hash-a") == ("claimed", None)
    persistence.save_scenario_and_run(
        _scenario(), _run(), submission_key=key, request_sha256="hash-a",
    )
    assert persistence.get_submission(key) == {"status": "completed", "run_id": "run_test"}
    assert persistence.claim_submission(key, "hash-a") == ("completed", "run_test")
    with pytest.raises(RuntimeError, match="reservation disappeared"):
        persistence.save_scenario_and_run(
            _scenario("rolled_back"), _run("second", "rolled_back"),
            submission_key=key, request_sha256="hash-a",
        )
    assert persistence.get_scenario("rolled_back") is None


def test_missing_initialized_database_is_not_recreated(tmp_path, monkeypatch):
    path = tmp_path / "vanished.db"
    monkeypatch.setattr(persistence, "DB_PATH", str(path))
    persistence.init_db()
    with persistence.get_conn() as conn:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    path.unlink()
    assert persistence.database_health() is False
    assert not path.exists()


def test_opt_in_orphan_repair_preserves_run_and_marks_inferred_scenario(tmp_path, monkeypatch):
    source = tmp_path / "orphan-source.db"
    monkeypatch.setattr(persistence, "DB_PATH", str(source))
    persistence.init_db()
    orphan = _run("orphan_run", "missing")
    orphan["calendar"] = {
        "race_count": 20,
        "weekend_count": 20,
        "breaks": [],
        "races": [
            {"weekend_id": f"2026-03-{i + 1:02d}", "circuit_id": f"c{i}"}
            for i in range(20)
        ],
    }
    with sqlite3.connect(source) as conn:
        persistence._insert_run(conn, orphan)
        conn.commit()
    assert db_admin.inspect_database(source)["foreign_key_violations"] == 1
    target = tmp_path / "recovered.db"
    report = db_admin.migrate_database(source, target, repair_orphans=True)
    assert (report["scenarios"], report["runs"], report["foreign_key_violations"]) == (1, 1, 0)
    assert report["recovered_orphans"][0]["original_scenario_id"] == "missing"
    with sqlite3.connect(target) as conn:
        row = conn.execute("SELECT s.config_complete, r.id FROM runs r JOIN scenarios s ON s.id = r.scenario_id").fetchone()
        assert row == (0, "orphan_run")
    monkeypatch.setattr(persistence, "DB_PATH", str(target))
    assert persistence.get_run("orphan_run")["scenario_id"].startswith("scn_recovered_")
    assert db_admin.inspect_database(source)["foreign_key_violations"] == 1
