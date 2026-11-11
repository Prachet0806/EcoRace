# Deploy — EcoRace Planner

The frontend and API are separate deployments. Configure the frontend with the
public API URL at build time.

## Architecture: stateless

The backend is a synchronous optimization service with no database and no
persistent disk. Every `POST /api/v1/optimization/runs` request runs the solver,
validates the result, and returns the complete result JSON in the response.

Completed optimization results live in **browser session storage only**. The
backend does not retain run history. Closing the browser tab discards session
history. Users who want to keep a result should download the result JSON
(available on the results page).

```
Vercel — Next.js
    |
    | HTTPS POST: optimization request
    v
Single Render backend instance
    |
    +-- FastAPI request validation
    +-- In-memory scenario construction
    +-- OR-Tools + heuristic optimization
    +-- Independent solution validation
    +-- Result serialization
    v
Complete JSON response
    |
    v
Browser sessionStorage
```

## Backend (FastAPI)

Any container host (Fly.io, Render, Azure Container Apps, plain VM):

```sh
# from repo root
docker build -f backend/Dockerfile -t ecorace-api:0.1.0 .
docker run -p 8000:8000 \
  -e SOLVER_TIMEOUT_SECONDS=30 \
  -e ECORACE_CORS_ORIGINS=https://<your-frontend-host> \
  ecorace-api:0.1.0
```

Notes:

- Image bakes in `data/` (42 venues, horizons, weather-v1). New data = rebuild and redeploy.
- OR-Tools needs ~512 MB RAM for 24-race solves; give the container ≥1 GB (2 GB recommended).
- **No persistent disk required.** The image creates no database directory.
- Run one process, one Uvicorn worker, one solver slot. The semaphore and
  circuit breaker are process-local. Horizontal scaling requires a separate
  coordination layer (Redis or similar) that is out of scope for this pilot.
- Reference data is immutable at runtime. To update circuits, seasons, or
  weather, rebuild and redeploy the Docker image.
- Request quotas are in-memory per process. A restart resets quotas. This is
  acceptable for the pilot.
- Weather is a synthetic demonstration fixture, not historical climate data or
  a forecast. The objective minimizes great-circle route distance, not carbon.

### Cold-start behavior (Render)

Render spins up the container on the first request if it has been idle.
Cold-start time is typically 5–15 seconds. The solver runs synchronously;
set `SOLVER_TIMEOUT_SECONDS` to leave a margin below Render's request timeout.

### Reference-data updates

1. Update files under `data/`.
2. Build and push a new Docker image.
3. Redeploy on Render.

No migration, backup, or restore procedure is needed.

## Frontend (Next.js)

Vercel (recommended) or any Node host:

1. Import `frontend/` as the project root.
2. Set env: `NEXT_PUBLIC_ECORACE_API_URL=https://<your-api-host>` (baked at
   build time — rebuild if the API URL changes).
3. Build: `npm run build`. No server config needed (no SSR data fetching;
   results route is client-rendered).

## Deployment smoke test

Run after every deploy:

```sh
API=https://<your-api-host>

# Health
curl -fsS "$API/api/v1/health" | jq -e '.status == "ok"'

# Circuits
curl -fsS "$API/api/v1/circuits" | jq -e '.count >= 20'

# Season weekends
curl -fsS "$API/api/v1/seasons/2026/weekends" | jq -e '.count == 40'

# Optimization (adjust circuit IDs from /circuits response)
IDS=$(curl -fsS "$API/api/v1/circuits" | jq -c '[.circuits[:20][].id]')
curl -fsS -X POST "$API/api/v1/optimization/runs" \
  -H 'content-type: application/json' \
  -d "{\"race_count\":20,\"circuit_ids\":$IDS,\"budget_s\":9}" \
  | jq -e '.status | test("feasible")'

# Invalid request
curl -fsS -X POST "$API/api/v1/optimization/runs" \
  -H 'content-type: application/json' \
  -d '{"race_count":22,"circuit_ids":[]}' \
  | jq -e '.error.code == "INSUFFICIENT_CIRCUITS"'
```

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
| `SOLVER_TIMEOUT_SECONDS` | API | `30` | Total sync budget per run. Leave a margin below the platform request timeout. |
| `SOLVER_CP_SAT_PRESOLVE` | API | `1` | Set to `0` for a controlled presolve-off comparison. |
| `SOLVER_DIAGNOSTICS` | API | `0` | Set to `1` to emit bounded CP-SAT progress logs. |
| `SOLVER_MAX_CONCURRENT` | API | `1` | Simultaneous solves per process. Keep at 1 for the pilot. |
| `SOLVER_CIRCUIT_BREAKER_THRESHOLD` | API | `5` | Consecutive solver failures before 503. |
| `SOLVER_CIRCUIT_BREAKER_COOLDOWN_S` | API | `60` | Cooldown before half-open. |
| `ECORACE_CORS_ORIGINS` | API | `http://localhost:3000` | Must list the frontend origin. |
| `ECORACE_DATA_DIR` | API | baked `data/` | Override only for custom datasets. |
| `ECORACE_MAX_REQUEST_BYTES` | API | `16384` | Maximum request body size. |
| `RATE_LIMIT_RUNS` | API | `10/minute` | Optimization request limit per client IP. |
| `RATE_LIMIT_HEALTH` | API | `120/minute` | Health endpoint limit. |
| `RATE_LIMIT_CIRCUITS` | API | `60/minute` | Circuit-list request limit. |
| `RATE_LIMIT_WEEKENDS` | API | `60/minute` | Season weekends limit. |
| `LOG_LEVEL` | API | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `NEXT_PUBLIC_ECORACE_API_URL` | web | `http://localhost:8000` | Build-time. |

For a repeatable 24-race presolve comparison, see [Solver diagnostics](SOLVER_DIAGNOSTICS.md).

## Session-history contract

| User action | Expected result |
|---|---|
| Navigate from builder to result | Result remains available |
| Refresh result page | Result remains available |
| Open another result in same tab | Earlier result remains available |
| Navigate back to builder | Draft remains available |
| Compare previous runs | Works for retained session results |
| Open result URL in a new tab | Result may be unavailable |
| Close browser tab | Session history is discarded |
| Backend restarts | Existing browser results remain available |
| Backend becomes unavailable | Existing browser results remain available |
| New optimization while backend unavailable | Clear service-unavailable error |

**Browser session storage is not a backup system.** Users should download
results they want to retain. The downloadable JSON export on the results page
serves this purpose.
