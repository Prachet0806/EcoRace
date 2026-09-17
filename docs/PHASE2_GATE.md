# Phase 2 Gate Report — CLOSED 2026-09-17

## Scope
FastAPI application layer: reference-data loader, orchestration service,
DTOs, stable errors, 5 endpoints, CORS, budget env, in-memory run store.
`optimize()` untouched — API is a thin adapter (verified: no domain/solver
logic in `interface/`, no HTTP/SQL in `application/` beyond transport).

## Endpoints (`/api/v1`)
- `GET /health` -> {status, dataset_version, weather_version}
- `GET /circuits` -> alpha-sorted library (42), count, dataset version
- `POST /scenarios` (201) -> validated scenario + horizon + weekend count
- `POST /optimization/runs` (sync) -> full result: ordered races
  (race_id/weekend Fri-Sun/circuit+coords), segments with km legs,
  metrics (total/baseline/saving), per-constraint status + violations,
  solver metadata (name/version/runtime/seed/status/proven/origin),
  data_version. Persisted in-memory under run_id.
- `GET /optimization/runs/{run_id}` -> stored result or RUN_NOT_FOUND (404)

## Contracts
- Error envelope `{error: {code, message, details}}` for AppError (domain
  codes pass through: INSUFFICIENT/EXCESS/DUPLICATE/UNKNOWN/INVALID_*) and
  schema failures (INVALID_REQUEST). SCENARIO_INFEASIBLE (422),
  SOLVER_TIMEOUT (504), SOLVER_FAILURE (500).
- Budget: `SOLVER_TIMEOUT_SECONDS` (default 30, total sync budget) split
  evenly across the Phase 1 seed portfolio; per-request `budget_s`/`seed`
  overrides. Recorded in run metadata.
- CORS: `ECORACE_CORS_ORIGINS` (default http://localhost:3000), GET+POST.

## Evidence
- pytest: 29/29 (21 prior + 8 `test_api`: health, sorted/versioned
  circuits, scenario create, 6 error codes, run contract incl.
  segment-race consistency + beats-baseline + all-constraints-satisfied,
  roundtrip/404, fast error paths, CORS header).
- Live smoke: uvicorn boot, `/health` + `/circuits` via HTTP, no stray
  processes after.

## Artifacts
`infrastructure/data_loader.py`, `application/optimization_service.py`,
`interface/http/{app,routes,schemas,errors}.py`, `tests/test_api.py`.

## Boundary to Phase 3 (Builder UI)
`GET /circuits` + `POST /optimization/runs` are the only calls the builder
needs. Frontend targets `NEXT_PUBLIC_ECORACE_API_URL` at the Phase 2 base.
