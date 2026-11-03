"""Offline SQLite backup, migration, and restore helpers.

Run with ``python -m ecorace.infrastructure.db_admin``. Restore always writes a
new file; stop the API before switching ECORACE_DB_PATH to that file.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path

from ecorace.infrastructure import persistence


def inspect_database(path: str | Path) -> dict:
    source = Path(path).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as conn:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        return {
            "path": str(source),
            "schema_version": conn.execute("PRAGMA user_version").fetchone()[0],
            "integrity": conn.execute("PRAGMA quick_check").fetchone()[0],
            "foreign_key_violations": len(conn.execute("PRAGMA foreign_key_check").fetchall()),
            "scenarios": conn.execute("SELECT count(*) FROM scenarios").fetchone()[0]
            if "scenarios" in tables
            else 0,
            "runs": conn.execute("SELECT count(*) FROM runs").fetchone()[0]
            if "runs" in tables
            else 0,
        }


def _repair_orphan_runs(path: Path) -> list[dict[str, str]]:
    """Attach each orphaned run to an incomplete scenario inferred from its calendar."""
    recovered: list[dict[str, str]] = []
    with closing(sqlite3.connect(path)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("BEGIN IMMEDIATE")
        try:
            orphans = conn.execute(
                "SELECT r.* FROM runs r LEFT JOIN scenarios s ON s.id = r.scenario_id "
                "WHERE s.id IS NULL ORDER BY r.id"
            ).fetchall()
            for run in orphans:
                calendar = json.loads(run["calendar_json"])
                races = calendar.get("races", [])
                circuit_ids = [race["circuit_id"] for race in races]
                weekend_ids = [race["weekend_id"] for race in races] + calendar.get("breaks", [])
                if (
                    len(circuit_ids) != run["race_count"]
                    or len(set(circuit_ids)) != len(circuit_ids)
                    or len(set(weekend_ids)) != calendar.get("weekend_count")
                    or not weekend_ids
                ):
                    raise RuntimeError(f"Cannot safely infer scenario for orphaned run {run['id']}")
                new_id = f"scn_recovered_{run['id']}_{run['scenario_id']}"
                conn.execute(
                    "INSERT INTO scenarios "
                    "(id, race_count, circuit_ids, season_year, weekend_count, "
                    "horizon_start, horizon_end, config_complete, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
                    (
                        new_id, run["race_count"], json.dumps(circuit_ids),
                        run["season_year"], calendar["weekend_count"],
                        min(weekend_ids), max(weekend_ids), run["created_at"],
                    ),
                )
                conn.execute("UPDATE runs SET scenario_id = ? WHERE id = ?", (new_id, run["id"]))
                recovered.append({
                    "run_id": run["id"],
                    "original_scenario_id": run["scenario_id"],
                    "recovered_scenario_id": new_id,
                    "basis": "calendar_snapshot; original constraints unknown",
                })
            if conn.execute("PRAGMA foreign_key_check").fetchone() is not None:
                raise RuntimeError("Foreign-key violations remain after recovery")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return recovered


def migrate_database(source: str | Path, destination: str | Path, *, repair_orphans: bool = False) -> dict:
    """Copy an existing SQLite database, migrate the copy, and verify row counts."""
    before = inspect_database(source)
    if before["integrity"] != "ok":
        raise RuntimeError("Source database failed integrity check")
    target = persistence.backup_database(source, destination)
    old_path = persistence.DB_PATH
    try:
        persistence.DB_PATH = str(target)
        persistence.init_db(backup_before_migration=False)
    finally:
        persistence.DB_PATH = old_path
    recovered = _repair_orphan_runs(target) if repair_orphans else []
    after = inspect_database(target)
    if (
        after["integrity"] != "ok"
        or after["foreign_key_violations"] != (0 if repair_orphans else before["foreign_key_violations"])
        or after["scenarios"] != before["scenarios"] + len(recovered)
        or after["runs"] != before["runs"]
    ):
        raise RuntimeError(f"Migrated database failed verification: {after}")
    return {**after, "recovered_orphans": recovered}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    check = actions.add_parser("check", help="Check integrity, schema version, and row counts")
    check.add_argument("path", nargs="?", default=persistence.DB_PATH)
    check.add_argument("--strict", action="store_true", help="Fail unless integrity, foreign keys, and schema version pass")
    for name in ("backup", "restore", "migrate"):
        command = actions.add_parser(name, help=f"Write a new SQLite file for {name}")
        command.add_argument("source")
        command.add_argument("destination")
        if name == "migrate":
            command.add_argument("--repair-orphans", action="store_true", help="Infer one incomplete scenario per orphaned run in the new copy")
    args = parser.parse_args()
    if args.action == "check":
        result = inspect_database(args.path)
    elif args.action == "migrate":
        result = migrate_database(args.source, args.destination, repair_orphans=args.repair_orphans)
    else:
        target = persistence.backup_database(args.source, args.destination)
        result = inspect_database(target)
    print(json.dumps(result, indent=2))
    if args.action == "check" and args.strict and (
        result["integrity"] != "ok"
        or result["foreign_key_violations"] != 0
        or result["schema_version"] != persistence.SCHEMA_VERSION
    ):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
