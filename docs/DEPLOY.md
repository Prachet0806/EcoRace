# Deploy — EcoRace Planner

The frontend and API are separate deployments. Configure the frontend with the
public API URL at build time.

## Backend (FastAPI)

Any container host (Fly.io, Render, Azure Container Apps, plain VM):

```sh
# from repo root
docker build -f backend/Dockerfile -t ecorace-api:0.1.0 .
docker run -p 8000:8000 \
  -v ecorace-data:/var/data \
  -e SOLVER_TIMEOUT_SECONDS=30 \
  -e ECORACE_CORS_ORIGINS=https://<your-frontend-host> \
  ecorace-api:0.1.0
```

Notes:

- Image bakes in `data/` (42 venues, horizons, weather-v1). New data = rebuild.
- OR-Tools needs ~512 MB RAM for 24-race solves; give the container ≥1 GB.
- **Persistence**: SQLite database at `/var/data/ecorace.db` (mounted volume
  `ecorace-data`). Runs survive container restarts with this volume. Do not
  mount over `/app/data`: that directory contains the reference data.
- The Render blueprint uses one paid web instance and a persistent disk mounted
  at `/var/data`. Startup refuses to serve if `ECORACE_REQUIRE_PERSISTENT_DB=1`
  and the mount is missing. A free Render web service cannot attach a persistent
  disk ([Render free plan](https://render.com/docs/free)).
- The public API has no account system. A random 128-bit run ID is the bearer
  capability for result lookup; keep result links private. Global history and
  deletion are not exposed. Account-level access control needs a separate
  authentication feature before use with sensitive multi-user data.
- Request quotas and idempotency status live in SQLite, so a restart does not
  reset either. The browser reuses the same submission key after a failed or
  interrupted request. A restart marks in-progress synchronous jobs as
  `interrupted`; retrying the same key starts a new solve.
- Weather is a synthetic demonstration fixture, not historical climate data or
  a forecast. The objective minimizes great-circle route distance, not carbon.
- Health gates for the platform: frontend `GET /api/health` → 200, and API
  `GET /api/v1/health` → 200 only while SQLite is available, with solver
  status, memory, and circuit-breaker state.
- CI is configured to build the image and exercise health, circuit data, one
  solve, and restart recovery using the documented volume. Confirm its result
  before deployment; run the same smoke check on the host.

### SQLite migration and recovery

SQLite remains a single-instance store. Connections are short-lived, use WAL,
foreign keys, and a five-second busy timeout. A connection pool adds no benefit
for this deployment. Keep one API instance and one solver slot; do not scale
the service horizontally while it uses this disk.

Before replacing an existing deployment, obtain its SQLite file **while it is
still available**. The old free Render service has ephemeral storage, so a
restart can make that file unrecoverable. The first startup against an older
schema creates a consistent `pre-v4` backup beside the database before applying
migrations. Use the offline tool to prepare and inspect a copy first:

```sh
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin check old.db
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin migrate old.db new.db
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin check new.db --strict
```

`migrate` preserves source data and refuses to overwrite its destination. It
verifies integrity, schema version, scenario and run counts, and that migration
did not introduce foreign-key violations. Any violations already present are
reported and need separate investigation before release.

If a legacy run points to a missing scenario, an opt-in repair can create one
incomplete scenario per run from its saved calendar on a **new copy**:

```sh
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin migrate old.db repaired.db --repair-orphans
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin check repaired.db --strict
```

Save the `recovered_orphans` mapping printed by the migration command with the
release record. The synthetic scenario ID includes the former ID and run ID;
`config_complete=0` makes clear that the original constraints are unknown.
Review the inferred rows and result retrieval before promoting that copy.

The local development database has two pre-existing runs referring to the
missing scenario ID `repro`. They use different circuit sets, so the missing
scenario cannot be reconstructed unambiguously. An automatic `pre-v4` backup
preserves the earlier schema and rows. The opt-in repair above keeps both runs
and gives each an incomplete scenario; review it before promoting a copy.

Back up with SQLite's online backup API, not a raw copy of a live WAL file.
Transfer backups off the service disk and rehearse restoration:

```sh
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin backup /var/data/ecorace.db /var/data/backups/ecorace-YYYYMMDD.db
PYTHONPATH=backend/src python -m ecorace.infrastructure.db_admin check /var/data/backups/ecorace-YYYYMMDD.db
```

For rollback or restore, stop the API, use `restore BACKUP NEW_DB_PATH`, check
the new file, point `ECORACE_DB_PATH` at it, and restart. Never overwrite the
active database or copy only its `.db` file while WAL is active. Render disk
snapshots are a recovery net, not a replacement for independent database
backups ([Render disk guidance](https://render.com/docs/disks)). Confirm a
hosted restart and restore drill before promising durable result links.

## Frontend (Next.js)

Vercel (recommended) or any Node host:

1. Import `frontend/` as the project root.
2. Set env: `NEXT_PUBLIC_ECORACE_API_URL=https://<your-api-host>` (baked at
   build time — rebuild if the API URL changes).
3. Build: `npm run build`. No server config needed (no SSR data fetching;
   results route is client-rendered).

## Pre-flight (run before every deploy)

```sh
# backend (~60s)
python -m pytest backend/tests/ -q
# frontend
cd frontend && npm test && npm run typecheck && npm run build && npx playwright test
```

## Production env recap

| Var | Where | Default | Notes |
|---|---|---|---|
| `SOLVER_TIMEOUT_SECONDS` | API | `30` | total sync budget per run |
| `ECORACE_CORS_ORIGINS` | API | `http://localhost:3000` | must list the frontend origin |
| `ECORACE_DATA_DIR` | API | baked `data/` | override only for custom datasets |
| `ECORACE_DB_PATH` | API | `/var/data/ecorace.db` in Docker | SQLite database path (use volume) |
| `ECORACE_REQUIRE_PERSISTENT_DB` | API | `1` on Render | refuse startup without the mounted disk |
| `ECORACE_DB_MOUNT` | API | `/var/data` | expected persistent mount path |
| `ECORACE_DB_BUSY_TIMEOUT_S` | API | `5` | SQLite write-lock wait |
| `SOLVER_MAX_CONCURRENT` | API | `1` | simultaneous solves per process; size after memory tests |
| `LOG_LEVEL` | API | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `SOLVER_CIRCUIT_BREAKER_THRESHOLD` | API | `5` | consecutive solver failures before 503 |
| `SOLVER_CIRCUIT_BREAKER_COOLDOWN_S` | API | `60` | cooldown before half-open |
| `RATE_LIMIT_DEFAULT` | API | `60/minute` | default rate limit |
| `RATE_LIMIT_HEALTH` | API | `120/minute` | health endpoint limit |
| `RATE_LIMIT_CIRCUITS` | API | `60/minute` | circuits endpoint limit |
| `RATE_LIMIT_WEEKENDS` | API | `60/minute` | season weekends endpoint limit |
| `RATE_LIMIT_RUNS` | API | `10/minute` | optimization creation limit |
| `RATE_LIMIT_GET_RUN` | API | `60/minute` | result lookup limit |
| `ECORACE_MAX_REQUEST_BYTES` | API | `16384` | maximum request body size |
| `NEXT_PUBLIC_ECORACE_API_URL` | web | `http://localhost:8000` | build-time |
