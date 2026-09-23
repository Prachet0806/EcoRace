"""SQLite persistence layer for scenarios and optimization runs."""
from __future__ import annotations

import json
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
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        with open(SCHEMA_PATH) as f:
            conn.executescript(f.read())
        conn.commit()


def _scenario_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "scenario_id": row["id"],
        "race_count": row["race_count"],
        "circuit_ids": json.loads(row["circuit_ids"]),
        "season_year": row["season_year"],
        "weekend_count": row["weekend_count"],
        "horizon": {"start": row["horizon_start"], "end": row["horizon_end"]},
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
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def save_scenario(scn: dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO scenarios (id, race_count, circuit_ids, season_year, weekend_count, horizon_start, horizon_end, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                scn["scenario_id"],
                scn["race_count"],
                json.dumps(scn["circuit_ids"]),
                scn["season_year"],
                scn["weekend_count"],
                scn["horizon"]["start"],
                scn["horizon"]["end"],
            ),
        )
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


def save_run(run: dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO runs (
                id, scenario_id, status, season_year, race_count,
                calendar_json, segments_json, metrics_json, constraints_json, solver_json,
                data_version, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
            ),
        )
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


def delete_old_runs(retention_days: int = 30) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM runs WHERE created_at < datetime('now', ?)", (f"-{retention_days} days",)
        )
        conn.commit()
        return cur.rowcount