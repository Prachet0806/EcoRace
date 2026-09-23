# UI V2 Gate Report — CLOSED 2026-09-17
<!-- Amendment 2026-09-18: routes moved to / + /results/[runId] (old paths
  redirect); official mode locks editing + chronological order; preview is a
  live mini-map; e2e executed 8/8; Docker verified. PHASE3/4_GATE route
  references are historical records of their verification dates. -->

## Scope
Frontend/Product V2: builder workstation + results workspace overhaul.
Backend exception (approved, additive only): `Circuit` carries existing
provenance fields and `GET /circuits` exposes them. No endpoint, DTO-shape,
solver, or invariant changes. All other backend files untouched.

## Builder definition of done
- [x] Two-pane selector preserved; selection order + alphabetical restore intact
- [x] Search filters available only; data-derived region chips
- [x] Whole-row single buttons, frozen `Select/Deselect {name}` names
- [x] Keyboard selection works; exact-match rail reuses `selectionError()`
- [x] Geographic composition (descriptive bars) + live mini-map preview
      (MapLibre, shared vendored worker; replaced SVG dots)
- [x] Season dropdown removed; Official/Custom source modes (venue-set preset only)
- [x] Official mode preset-loads: 24 venues fill the left pane in chronological 2026 order, right pane empties, user optimizes manually
- [x] Official mode locks editing (disabled rows, hidden Clear, locked race count)
- [x] Empty-preset guard: explicit OFFICIAL_PRESET_UNAVAILABLE on stale data
- [x] Fixed vs configurable policies visually separated
- [x] Command center with real states, no fake progress

## Results definition of done
- [x] Impact hero (totals, baseline, change) + factual comparison table
- [x] Hero optimized-only route map (no baseline geometry in API)
- [x] Month/week calendar timeline with explicit break bands
- [x] Travel-leg explorer with region transitions + click/hover map sync
- [x] Constraint diagnostics with counts + affected assignments
- [x] Run provenance from payload fields only
- [x] Limitations stated; missing/error states honest

## Engineering definition of done
- [x] Zustand single-source invariant preserved; no TanStack Query
- [x] `fetch()` only in `api-client.ts` (contract-tested with mocked fetch)
- [x] TypeScript clean; Vitest 21/21 (incl. timeline rows, preset, contracts)
- [x] Next build green (routes / + /results/[runId]; /ecorace* redirects)
- [x] Backend pytest 34/34 + API provenance test (f1_current_2026 ×24)
- [x] Playwright 8/8 on a clean machine (flow, map loaded-signal, visual artifacts)
- [x] Docker image built + booted: /health OK, 42 circuits (see DEPLOY.md)
- [x] Accessibility: native controls, labels, live regions, focus ring,
      keyboard paths preserved; mobile tabs share pane DOM/state
- [x] ADR-FE-007 recorded (source preset limits, optimized-only map,
      mini-map preview, additive backend exception)
- [x] Shared chrome: amplified TopBar, chamfered back button, red/yellow
      pinstripe + header visibility (giallo kicker, ink meta)

## Artifacts (amended)
`components/layout/{AppShell,TopBar,PageContainer}.tsx`,
`components/ui/BackToBuilder.tsx`, `components/map/maplibre.ts`,
`public/maplibre/` (vendored worker),
`features/builder/{CalendarSourceSelector,TrackWorkspace,SelectedTracksPane,
AvailableTracksPane,CircuitRow,SelectionStatus,CalendarRules,
OptimizationCommand,ScenarioHeader}.tsx`,
`features/geography/{official,SelectionMap}.ts(x)`, results rework
(`MetricsDashboard,CalendarTimeline,TravelLegs,ConstraintDiagnostics,
RunProvenance`), `e2e/{flow,map,visual}.spec.ts`, `api-client.test.ts`.
