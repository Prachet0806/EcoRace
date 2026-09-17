# ADR-FE-007 — Calendar-source preset + V2 contract guards

Status: Accepted.

## Decision

- Builder offers `custom` (manual two-pane selection) and
  `official-2026-venues` (preset: all circuits with `f1_current_2026`,
  `raceCount` locked to the preset size, `season_year=2026` fixed).
- Official mode is a **venue-set preset only**. The backend exposes no
  official dates/order (seasons files carry weekends only), so the UI must
  never claim official dates or order. Copy: "official 2026 venue set".
- Selecting Official **preset-loads only**: the 24 venues fill the left
  pane in chronological 2026 race order (Melbourne → Yas Marina, per the
  FIA/FOM calendar announcement; unknown IDs append rather than vanish),
  the right   pane empties, and the user runs the optimization themselves.
  No auto-run. The order also flows into the baseline, which follows
  input order — making the baseline the official-order reference.
- Official mode **locks selection editing**: both panes' rows and Clear
  are disabled with a "Locked to official set" note; race count is locked.
  Manual edits (which revert to Custom) are unreachable while locked.
- Hero results map stays **optimized-only**: the API returns
  `baseline_distance_km` without baseline route geometry. Baseline
  comparison remains numeric and factual.
- Builder geographic preview is a **live mini MapLibre map** (dark
  basemap, yellow markers, static/non-interactive), sharing the vendored
  worker fix. The earlier SVG-dots preview never read as geography
  (dots on black without landmass), so it was replaced; `project.ts`
  remains as a tested utility.
- Venue taxonomy (`F1 2026` / `Former F1 venue` / `FIA Grade 1`) derives
  frontend-side from existing circuit fields.
- Approved backend exception (additive only, no contract break): expose
  existing provenance fields (`fia_license_grade`, `f1_current_2026`,
  `f1_hosted_seasons`, `venue_source`) on `GET /circuits`. No endpoint,
  DTO-shape, or solver behavior changes.

## Non-goals

- No TanStack Query; `api-client.ts` remains the only fetch site.
- No baseline route layer until backend geometry exists.
- No blocking pixel baselines; screenshots are artifacts only.
