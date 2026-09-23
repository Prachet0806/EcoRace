# EcoRace Planner

> CI runs backend pytest, frontend typecheck/vitest/build/e2e, and the Docker build on every push and PR — see [.github/workflows/ci.yml](.github/workflows/ci.yml). Add a status badge with your repo slug once pushed to GitHub.

**A decision-support platform for optimizing the F1 calendar for sustainability and logistics efficiency.**

Construct a candidate calendar (20–24 races from 42 real venues), optimize the
travel route under hard scheduling and weather constraints, and inspect the
result: timeline, route map, metrics, and baseline comparison.

> Decision-support experiment, not an authoritative F1 calendar.
> Distances are great-circle approximations; weather is a feasibility policy,
> not a forecast. See `ecorace-planner-docs/13_LIMITATIONS_AND_ASSUMPTIONS.md`.

## How it works

```text
Select tracks → Configure calendar → Optimize → Inspect result
```

1. **Builder** (`/`): two-pane track selector, race count 20–24, season 2025/2026.
2. **Optimizer** (FastAPI): CP-SAT + heuristic portfolio minimizing total travel
   distance subject to one-race-per-weekend, max 3 consecutive races + break,
   weather feasibility, and circuit uniqueness.
3. **Results** (`/results/{run_id}`): timeline, MapLibre route, metrics,
   baseline comparison, travel legs, constraint diagnostics.

## Repo map

```text
backend/src/ecorace/   FastAPI + domain + optimization core
  domain/               circuits, calendar, constraints (framework-free)
  optimization/         solver pipeline: result = optimize(problem)
  application/          scenario/run orchestration (no HTTP/SQL)
  interface/http/       routes, DTOs, error envelope
  infrastructure/       JSON reference-data loader
backend/tests/          pytest suite (29 tests) + benchmark harnesses
frontend/src/           Next.js (App Router) + Tailwind + zustand + MapLibre
  app/                   builder page (`page.tsx` at root)
  app/results/[runId]/     results page
  features|components|lib|domain|utils
data/                   circuits (FIA Grade 1 + F1 2020–2026, 42 venues),
                        season horizons, weather policy, dataset version
docs/                   ADRs, FORMULATION.md, benchmarks, phase gate reports
ecorace-planner-docs/   product spec (13 docs: PRD → limitations)
```

## Core architectural principle

> The optimization core runs as a standalone Python library — no HTTP server,
> database, frontend, or external service required.

```python
result = optimize(problem)
```

Storage, HTTP, weather providers, and solver implementations are adapters
around the domain + optimization core. Forbidden directions (`domain → FastAPI`,
`domain → OR-Tools`, components → raw `fetch()`) are gate-checked.

## Status

| Phase | State |
|---|---|
| 0 — Contracts, domain, data, scaffold | ✅ closed (`docs/PHASE0_GATE.md`) |
| 1 — Optimization core + benchmark | ✅ closed (`docs/PHASE1_GATE.md`) |
| 2 — API (5 endpoints, CORS, budgets) | ✅ closed (`docs/PHASE2_GATE.md`) |
| 3 — Builder UI | ✅ closed (`docs/PHASE3_GATE.md`) |
| 4 — Results route | ✅ closed (`docs/PHASE4_GATE.md`) |
| 5 — Hardening / release | ✅ closed (`docs/PHASE5_GATE.md`) — **MVP COMPLETE** |

## Quick start

See **[QUICKSTART.md](QUICKSTART.md)** — backend + frontend up in ~5 minutes.

## Key contracts

- Horizon: first Fri–Sun on/after Mar 1 → first Friday whose Sunday covers
  Dec 1 (40 weekends for 2025/2026); weekend ID = Friday date.
- Exact-match MVP: `len(circuit_ids) == race_count` (20–24).
- Streak limit configurable `max_consecutive` 2–7 (default 3), enforced with
  a mandatory break after a full run.
- Optional summer-break window (0-based weekend indices) excludes weekends
  from scheduling; optional December-finale pin fixes the last race to Dec W1.
- Monthly minimum: every horizon month untouched by the summer break hosts
  at least one race.
- Weather is a hard `Circuit × Weekend → feasible/infeasible` policy.
- Distance: Haversine km (`R = 6371.0088`), float end-to-end, rounded only
  for display.
- Every `feasible` result is independently validator-clean; non-optimal
  incumbents are marked `feasible_timeout`, never presented as optimal.
- Errors use `{error: {code, message, details}}` with stable codes
  (`INSUFFICIENT_CIRCUITS`, `SCENARIO_INFEASIBLE`, `SOLVER_TIMEOUT`, …).

## Version pins

Python 3.11.9 · Node 22 · Next 16.3.5 · FastAPI 0.128.2 · OR-Tools 9.15.6755 ·
zustand 5.0.15 · maplibre-gl 6.10.0. Full list: `docs/VERSIONS.md`.
