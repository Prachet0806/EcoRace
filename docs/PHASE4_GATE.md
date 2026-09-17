# Phase 4 Gate Report — CLOSED 2026-09-17

## Scope
Results route (`/ecorace/results/[runId]`): metrics, timeline, MapLibre
route, travel legs, constraint diagnostics, back-to-builder. No API/solver
changes (one live-run observation below, no action needed).

## Evidence
- `npm test`: 6/6 (store logic + great-circle endpoints/collapse/arch).
- `tsc --noEmit`: clean. `next build`: green (results route dynamic).
- `fetch()` only in `lib/api-client.ts` (grep-verified).
- Live E2E (API + `next start`): real 20-race run → `feasible`, 20 races,
  19 segments, 38,253 km, 0 unsatisfied constraints; results URL serves 200
  with the loading shell (client hydrates from session/API — browser-level
  hydration stays in hardening/Playwright).
- Ports 8000/3100 clean after smoke; no stray processes.

## Behavior contracts (09 §7, P0-10/11)
- Loader: sessionStorage stash → API refetch → `missing` (explains in-memory
  MVP semantics, offers back-nav) / `error` (CODE: message).
- MetricsDashboard: totals, baseline comparison table (factual, no composite
  score), optimality provenance, run/dataset IDs.
- CalendarTimeline: all 40 weekends chronological (weekend_id IS the Friday
  date, so lexicographic == chronological); breaks collapsed to gap rows.
- RouteMap (ssr:false, CARTO positron, no token): great-circle arcs (n=50),
  race points + sequence labels, bounds fit, WebGL-failure message; hover
  sync both directions via race_id/segment_id (race↔markers+adjacent legs,
  leg↔segment+endpoint races); keyed by run_id for fresh sources.
- TravelLegs: seg ids, endpoint names, km, hover sync.
- ConstraintDiagnostics: per-constraint ✓/✗ + violation detail.
- Back action returns to `/ecorace`; draft survives via zustand persist.
- Limitations footer on every result (approximation/policy disclaimer).

## Live-run note
A 6s-budget run returned `origin: heuristic` — keep-best working as
designed (solver seeds timed out, heuristic won, validator-clean). No change.

## Artifacts
`app/ecorace/results/[runId]/page.tsx`, `components/map/RouteMap.tsx`,
`features/results/{useRunResult,MetricsDashboard,CalendarTimeline,
TravelLegs,ConstraintDiagnostics}.tsx`, `lib/{types (RunPayload),geo}.ts`.

## Boundary to Phase 5 (Hardening / release)
Playwright e2e (select→optimize→inspect→modify→rerun incl. hydration +
map render), adversarial/API cases, a11y pass, deploy targets, footer copy
review. Only remaining MVP work.
