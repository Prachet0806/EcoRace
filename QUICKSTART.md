# Quick Start — EcoRace Planner

Get the API + builder running locally in ~5 minutes.

## 1. Prerequisites

- **Python 3.11.9** (`python --version`)
- **Node 22** (`node --version`), npm 11
- Ports free: **8000** (API), **3000** (web)

## 2. Backend (FastAPI)

```powershell
cd C:\Users\prach\Documents\EcoRace

# Install (once)
pip install "fastapi==0.128.2" "pydantic==2.12.5" "ortools==9.15.6755" uvicorn pytest httpx

# Run tests (once, ~60s — includes solver runs)
python -m pytest backend/tests/ -q

# Serve (from repo root; PYTHONPATH picks up backend/src)
$env:PYTHONPATH = 'backend/src'
python -m uvicorn ecorace.interface.http.app:app --port 8000
```

Verify:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
(Invoke-RestMethod http://localhost:8000/api/v1/circuits).count   # 42
```

Optional env (defaults shown):

```powershell
$env:SOLVER_TIMEOUT_SECONDS = '30'        # total sync budget per run, split across seeds
$env:ECORACE_CORS_ORIGINS = 'http://localhost:3000'
$env:ECORACE_DATA_DIR = 'C:\Users\prach\Documents\EcoRace\data'
```

## 3. Frontend (Next.js)

New terminal (leave the API running):

```powershell
cd C:\Users\prach\Documents\EcoRace\frontend

npm install        # once
npm test           # vitest unit tests
npm run dev        # http://localhost:3000/
```

Point the web app at your API (defaults to `http://localhost:8000`):

```powershell
Copy-Item .env.local.example .env.local   # edit URL if your API differs
```

Production build check: `npm run typecheck`, then `npm run build`.

## 4. First optimization (end to end)

**UI:** open http://localhost:3000/ → add 20 tracks → Optimize Calendar
→ results page (typical solve: 15–20s).

**API directly** (PowerShell):

```powershell
$ids = (Invoke-RestMethod http://localhost:8000/api/v1/circuits).circuits | Select-Object -First 20 -ExpandProperty id
$body = @{ race_count = 20; circuit_ids = $ids; season_year = 2026; budget_s = 9 } | ConvertTo-Json
$run = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/optimization/runs -Body $body -ContentType 'application/json'
$run.metrics          # total vs baseline distance
$run.calendar.races | Select-Object -First 3 race_id, weekend_id, circuit_name
Invoke-RestMethod "http://localhost:8000/api/v1/optimization/runs/$($run.run_id)" | Select-Object run_id, status
```

Rules that will reject your request (exact-match MVP):

- `len(circuit_ids)` must equal `race_count` (`INSUFFICIENT_`/`EXCESS_CIRCUITS`)
- no duplicates (`DUPLICATE_CIRCUIT`), IDs must exist (`UNKNOWN_CIRCUIT_ID`)
- `race_count` 20–24, `season_year` 2020–2030

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: ecorace` | set `$env:PYTHONPATH='backend/src'` from repo root |
| `UnicodeDecodeError` on circuits | pull latest — loader pins UTF-8; don't edit JSON in ANSI editors |
| Web shows "Could not load circuits" | API not on `:8000`, or set `NEXT_PUBLIC_ECORACE_API_URL` in `.env.local` + restart `npm run dev` |
| Solve feels slow | expected: sync budget ≈ `SOLVER_TIMEOUT_SECONDS`; lower `budget_s` per request for faster, slightly worse routes |
| `RUN_NOT_FOUND` after API restart | expected pre-DB: runs live in memory; re-run to get a fresh `run_id` |
| Port clash | `Get-NetTCPConnection -LocalPort 8000/3000` → stop the owner process |

## 6. What to read next

- `docs/PHASE2_GATE.md` — endpoint + error-code reference
- `docs/FORMULATION.md` — the frozen optimization model (+ measured solver notes)
- `ecorace-planner-docs/` — full product spec, start at `01_PRD.md`
