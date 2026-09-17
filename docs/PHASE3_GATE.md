# Phase 3 Gate Report — CLOSED 2026-09-17

## Scope
Scenario builder route (`/ecorace`): two-pane track selector, calendar
configuration, optimize flow. Run payload stashed to sessionStorage for the
results route (Phase 4). No solver/API changes.

## Evidence
- `npm test`: 3/3 (exact-match gating, single-source toggle/clear,
  20–24 clamping). DOM/e2e deferred to hardening (Playwright).
- `tsc --noEmit`: clean. `next build`: green (`/ecorace` static,
  `/ecorace/results/[runId]` dynamic).
- Live smoke (`next start`): 200 on `/ecorace`, SSR shell renders header,
  loading state, constraint panel, disabled Optimize with
  "Select 20 more tracks (0/20)".
- `fetch()` only in `lib/api-client.ts` (grep-verified).

## Behavior contracts (09 §3–§6)
- Selected (left, selection order) / Available (right, alpha + search);
  add/remove moves between panes; Clear resets.
- Race count stepper 20–24; season 2025/2026; horizon/weather/streak shown
  as fixed policy, solver internals hidden.
- Optimize enabled only at exact-match; running state notes 15–20s typical;
  API errors shown as `CODE: message`; success navigates to results.
- Draft persists via zustand/middleware (back-nav safe).

## Artifacts
`app/{globals.css,ecorace/page.tsx}`, `postcss.config.mjs`,
`.env.local.example`, `lib/{types,api-client,scenario-store}.ts`,
`features/{circuits/{TrackSelector,useCircuits},constraints/ConstraintPanel,
optimization/OptimizeButton}.tsx`, `vitest.config.ts`.

## Boundary to Phase 4 (Results route)
Reads `sessionStorage(ecorace:run:{id})` then `GET /runs/{id}` fallback;
renders timeline, MapLibre route, metrics, baseline, legs, diagnostics.
