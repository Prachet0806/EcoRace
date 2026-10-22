"""SQLite persistence layer for scenarios and optimization runs."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

DB_PATH = os.environ.get("ECORACE_DB_PATH", "./data/ecorace.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        with open(SCHEMA_PATH) as f:
            conn.executescript(f.read())
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
        orphan_count = len(conn.execute("PRAGMA foreign_key_check").fetchall())
        if orphan_count:
            logging.getLogger("ecorace.persistence").warning("existing_foreign_key_violations=%s", orphan_count)
        conn.commit()


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
        "pin_end_to_dec_week1": bool(row["pin_end_to_dec_week1"]) if row["pin_end_to_dec_week1"] is not None else None,
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
        "provenance": json.loads(row["provenance_json"]) if row["provenance_json"] else None,
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
            "SELECT * FROM scenarios ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
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


def save_scenario_and_run(scn: dict[str, Any], run: dict[str, Any]) -> None:
    """Publish a completed run and its scenario in one transaction."""
    with get_conn() as conn:
        _insert_scenario(conn, scn)
        _insert_run(conn, run)
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
