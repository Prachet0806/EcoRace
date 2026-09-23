-- EcoRace Planner SQLite Schema
-- Version 1: scenarios and runs tables

CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    race_count INTEGER NOT NULL,
    circuit_ids TEXT NOT NULL,
    season_year INTEGER NOT NULL,
    weekend_count INTEGER NOT NULL,
    horizon_start TEXT NOT NULL,
    horizon_end TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    season_year INTEGER NOT NULL,
    race_count INTEGER NOT NULL,
    calendar_json TEXT NOT NULL,
    segments_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    constraints_json TEXT NOT NULL,
    solver_json TEXT NOT NULL,
    data_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);