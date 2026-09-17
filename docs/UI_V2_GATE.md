# UI V2 Gate Report — CLOSED 2026-09-17

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
- [x] Geographic composition (descriptive bars) + SVG selection preview
- [x] Season dropdown removed; Official/Custom source modes (venue-set preset only)
- [x] Official mode preset-loads: 24 venues fill the left pane in chronological 2026 order, right pane empties, user optimizes manually
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
- [x] TypeScript clean; Vitest 20/20 (incl. timeline rows, preset, contracts)
- [x] Next build green
- [x] Backend pytest 34/34 (proves the exception is additive-safe)
- [x] E2E specs updated (source preset, new headings, visual artifacts);
      Playwright execution deferred per instruction (harness conflicts with
      live dev servers on :3000/:8000; re-run `npm run test:e2e` on a clean
      machine before release)
- [x] Accessibility: native controls, labels, live regions, focus ring,
      keyboard paths preserved; mobile tabs share pane DOM/state
- [x] ADR-FE-007 recorded (source preset limits, optimized-only map,
      SVG preview, additive backend exception)

## Artifacts
`components/layout/{AppShell,TopBar,PageContainer}.tsx`,
`features/builder/{CalendarSourceSelector,TrackWorkspace,SelectedTracksPane,
AvailableTracksPane,CircuitRow,SelectionStatus,CalendarRules,
OptimizationCommand,ScenarioHeader}.tsx`,
`features/geography/{official}.ts`, results rework
(`MetricsDashboard,CalendarTimeline,TravelLegs,ConstraintDiagnostics,
RunProvenance`), `e2e/{flow,map,visual}.spec.ts`, `api-client.test.ts`.
