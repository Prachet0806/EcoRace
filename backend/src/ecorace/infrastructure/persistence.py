"""SQLite persistence layer for scenarios and optimization runs."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

DB_PATH = os.environ.get("ECORACE_DB_PATH", "./data/ecorace.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"
SCHEMA_VERSION = 4
_INITIALIZED_PATH: Path | None = None


def _check_persistent_mount(path: Path) -> None:
    if os.environ.get("ECORACE_REQUIRE_PERSISTENT_DB") != "1":
        return
    mount = Path(os.environ.get("ECORACE_DB_MOUNT", "/var/data")).resolve()
    if not path.resolve().is_relative_to(mount) or not os.path.ismount(mount):
        raise RuntimeError(
            f"SQLite database must be under mounted persistent disk {mount}; refusing ephemeral storage"
        )


def backup_database(source: str | Path, destination: str | Path) -> Path:
    """Create a consistent, verified SQLite backup, including committed WAL data."""
    src = Path(source).resolve()
    dst = Path(destination).resolve()
    if not src.is_file() or src == dst or dst.exists():
        raise ValueError("Backup requires an existing source and a new destination path")
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        with closing(sqlite3.connect(src.as_uri() + "?mode=ro", uri=True)) as source_conn:
            with closing(sqlite3.connect(dst)) as target_conn:
                source_conn.backup(target_conn)
                if target_conn.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                    raise RuntimeError("SQLite backup failed integrity check")
    except Exception:
        dst.unlink(missing_ok=True)
        raise
    return dst


def database_health() -> bool:
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1").fetchone()
        return True
    except (sqlite3.Error, RuntimeError):
        return False


def consume_quota(scope: str, limit: int, window_s: int) -> tuple[bool, int]:
    """Atomically count a request in the persistent, fixed-window quota."""
    now = int(time.time())
    start = now // window_s * window_s
    bucket = f"{scope}:{start}"
    retry_after = max(1, start + window_s - now)
    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM api_quotas WHERE window_start < ?", (now - 7200,))
        row = conn.execute("SELECT count FROM api_quotas WHERE bucket = ?", (bucket,)).fetchone()
        if row is not None and row["count"] >= limit:
            conn.commit()
            return False, retry_after
        if row is None:
            conn.execute(
                "INSERT INTO api_quotas (bucket, window_start, count) VALUES (?, ?, 1)",
                (bucket, start),
            )
        else:
            conn.execute("UPDATE api_quotas SET count = count + 1 WHERE bucket = ?", (bucket,))
        conn.commit()
    return True, retry_after


def claim_submission(key: str, request_sha256: str) -> tuple[str, str | None]:
    """Reserve one solver submission; return its current lifecycle state."""
    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT request_sha256, status, run_id FROM submissions WHERE idempotency_key = ?",
            (key,),
        ).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO submissions (idempotency_key, request_sha256, status) VALUES (?, ?, 'running')",
                (key, request_sha256),
            )
            state, run_id = "claimed", None
        elif row["request_sha256"] != request_sha256:
            state, run_id = "conflict", None
        elif row["status"] in ("failed", "interrupted"):
            conn.execute(
                "UPDATE submissions SET status = 'running', updated_at = datetime('now') WHERE idempotency_key = ?",
                (key,),
            )
            state, run_id = "claimed", None
        else:
            state, run_id = row["status"], row["run_id"]
        conn.commit()
    return state, run_id


def fail_submission(key: str, request_sha256: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE submissions SET status = 'failed', updated_at = datetime('now') "
            "WHERE idempotency_key = ? AND request_sha256 = ? AND status = 'running'",
            (key, request_sha256),
        )
        conn.commit()


def interrupt_running_submissions() -> None:
    """A restart cannot resume synchronous work; make that state explicit."""
    with get_conn() as conn:
        conn.execute("UPDATE submissions SET status = 'interrupted' WHERE status = 'running'")
        conn.commit()


def get_submission(key: str) -> dict[str, str | None] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT status, run_id FROM submissions WHERE idempotency_key = ?", (key,)
        ).fetchone()
        return {"status": row["status"], "run_id": row["run_id"]} if row else None


@contextmanager
def get_conn():
    path = Path(DB_PATH).resolve()
    _check_persistent_mount(path)
    if _INITIALIZED_PATH == path and not path.is_file():
        raise RuntimeError("Initialized SQLite database is missing")
    timeout_s = float(os.environ.get("ECORACE_DB_BUSY_TIMEOUT_S", "5"))
    conn = sqlite3.connect(DB_PATH, timeout=timeout_s)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(f"PRAGMA busy_timeout = {int(timeout_s * 1000)}")
    try:
        yield conn
    finally:
        conn.close()


def init_db(*, backup_before_migration: bool = True) -> None:
    global _INITIALIZED_PATH
    path = Path(DB_PATH).resolve()
    _check_persistent_mount(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.stat().st_size:
        with closing(sqlite3.connect(path)) as conn:
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            if version > SCHEMA_VERSION:
                raise RuntimeError(f"Database schema v{version} is newer than this application")
            if conn.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise RuntimeError("SQLite database failed integrity check")
        if version < SCHEMA_VERSION and backup_before_migration:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup = path.with_name(f"{path.name}.pre-v{SCHEMA_VERSION}-{stamp}-{uuid4().hex[:8]}.db")
            backup_database(path, backup)
            logging.getLogger("ecorace.persistence").info("Pre-migration backup created: %s", backup)
    with get_conn() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript("BEGIN IMMEDIATE;\n" + SCHEMA_PATH.read_text(encoding="utf-8"))
        try:
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(scenarios)")}
            for name, definition in {
                "max_consecutive": "INTEGER",
                "summer_break_start": "INTEGER",
                "summer_break_end": "INTEGER",
                "pin_end_to_dec_week1": "INTEGER",
                "config_complete": "INTEGER NOT NULL DEFAULT 0",
            }.items():
                if name not in columns:
                    conn.execute(f"ALTER TABLE scenarios ADD COLUMN {name} {definition}")
            run_columns = {row["name"] for row in conn.execute("PRAGMA table_info(runs)")}
            if "provenance_json" not in run_columns:
                conn.execute("ALTER TABLE runs ADD COLUMN provenance_json TEXT")
            conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
            orphan_count = len(conn.execute("PRAGMA foreign_key_check").fetchall())
            if orphan_count:
                logging.getLogger("ecorace.persistence").warning(
                    "existing_foreign_key_violations=%s", orphan_count
                )
            conn.commit()
            _INITIALIZED_PATH = path
        except Exception:
            conn.rollback()
            raise


def _scenario_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "scenario_id": row["id"],
        "race_count": row["race_count"],
        "circuit_ids": json.loads(row["circuit_ids"]),
        "season_year": row["season_year"],
        "weekend_count": row["weekend_count"],
        "horizon": {"start": row["horizon_start"], "end": row["horizon_end"]},
        "max_consecutive": row["max_consecutive"],
        "summer_break_start": row["summer_break_start"],
        "summer_break_end": row["summer_break_end"],
        "pin_end_to_dec_week1": bool(row["pin_end_to_dec_week1"])
        if row["pin_end_to_dec_week1"] is not None
        else None,
        "config_complete": bool(row["config_complete"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _run_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "run_id": row["id"],
        "scenario_id": row["scenario_id"],
        "status": row["status"],
        "season_year": row["season_year"],
        "race_count": row["race_count"],
        "calendar": json.loads(row["calendar_json"]),
        "segments": json.loads(row["segments_json"]),
        "metrics": json.loads(row["metrics_json"]),
        "constraints": json.loads(row["constraints_json"]),
        "solver": json.loads(row["solver_json"]),
        "data_version": row["data_version"],
        "provenance": json.loads(row["provenance_json"])
        if row["provenance_json"]
        else None,
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def _insert_scenario(conn: sqlite3.Connection, scn: dict[str, Any]) -> None:
    conn.execute(
        """
            INSERT INTO scenarios (
                id, race_count, circuit_ids, season_year, weekend_count, horizon_start, horizon_end,
                max_consecutive, summer_break_start, summer_break_end, pin_end_to_dec_week1, config_complete, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            """,
        (
            scn["scenario_id"],
            scn["race_count"],
            json.dumps(scn["circuit_ids"]),
            scn["season_year"],
            scn["weekend_count"],
            scn["horizon"]["start"],
            scn["horizon"]["end"],
            scn["max_consecutive"],
            scn["summer_break_start"],
            scn["summer_break_end"],
            int(scn["pin_end_to_dec_week1"]),
        ),
    )


def save_scenario(scn: dict[str, Any]) -> None:
    with get_conn() as conn:
        _insert_scenario(conn, scn)
        conn.commit()


def get_scenario(scn_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM scenarios WHERE id = ?", (scn_id,)).fetchone()
        return _scenario_from_row(row) if row else None


def list_scenarios(limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM scenarios ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [_scenario_from_row(r) for r in rows]


def delete_scenario(scn_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM scenarios WHERE id = ?", (scn_id,))
        conn.commit()
        return cur.rowcount > 0


def _insert_run(conn: sqlite3.Connection, run: dict[str, Any]) -> None:
    conn.execute(
        """
            INSERT INTO runs (
                id, scenario_id, status, season_year, race_count,
                calendar_json, segments_json, metrics_json, constraints_json, solver_json,
                data_version, provenance_json, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
        (
            run["run_id"],
            run.get("scenario_id"),
            run["status"],
            run["season_year"],
            run["calendar"]["race_count"],
            json.dumps(run["calendar"]),
            json.dumps(run["segments"]),
            json.dumps(run["metrics"]),
            json.dumps(run["constraints"]),
            json.dumps(run["solver"]),
            run["data_version"],
            json.dumps(run.get("provenance")),
        ),
    )


def save_run(run: dict[str, Any]) -> None:
    with get_conn() as conn:
        _insert_run(conn, run)
        conn.commit()


def save_scenario_and_run(
    scn: dict[str, Any], run: dict[str, Any],
    *, submission_key: str | None = None, request_sha256: str | None = None,
) -> None:
    """Publish a completed run and its scenario in one transaction."""
    with get_conn() as conn:
        _insert_scenario(conn, scn)
        _insert_run(conn, run)
        if submission_key is not None:
            if request_sha256 is None:
                raise ValueError("request_sha256 is required with submission_key")
            updated = conn.execute(
                "UPDATE submissions SET status = 'completed', run_id = ?, updated_at = datetime('now') "
                "WHERE idempotency_key = ? AND request_sha256 = ? AND status = 'running'",
                (run["run_id"], submission_key, request_sha256),
            )
            if updated.rowcount != 1:
                raise RuntimeError("Submission reservation disappeared before run commit")
        conn.commit()


def get_run(run_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return _run_from_row(row) if row else None


def list_runs(
    scenario_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    with get_conn() as conn:
        sql = "SELECT * FROM runs WHERE 1=1"
        params: list[Any] = []
        if scenario_id:
            sql += " AND scenario_id = ?"
            params.append(scenario_id)
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(sql, params).fetchall()
        return [_run_from_row(r) for r in rows]
