# Deploy — EcoRace Planner MVP

Targets are unprovisioned on purpose: this file makes deployment a checklist,
not a project. MVP needs exactly two hosts (or one, if colocated).

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

- Image bakes in `data/` (42 venues, horizons, weather-v1). New data = rebuild.
- OR-Tools needs ~512 MB RAM for 24-race solves; give the container ≥1 GB.
- Runs/scenarios are in-memory: restarts clear them (documented MVP limit,
  fixed by V1.3 SQLite persistence). No volumes needed.
- Health gate for the platform: `GET /api/v1/health` → 200 `{"status":"ok"}`.

## Frontend (Next.js)

Vercel (recommended) or any Node host / static export:

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
| `NEXT_PUBLIC_ECORACE_API_URL` | web | `http://localhost:8000` | build-time |
