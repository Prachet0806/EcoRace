# Phase 5 Gate Report — CLOSED 2026-09-17 — MVP COMPLETE

## Scope
Hardening + release readiness: browser e2e, adversarial inputs, a11y pass,
deploy artifacts, data verification, full-suite green.

## Evidence
- Playwright 4/4 (`npm run test:e2e`, auto-starts API+web): exact-match
  gating, keyboard track selection, full select→optimize→inspect→modify→
  rerun with distinct run IDs, MapLibre canvas rendering with real WebGL.
  One real bug found and fixed: CORS rejected the :3100 e2e origin
  (API default allows :3000) — fixed in `playwright.config.ts` env.
- pytest 34/34 (29 prior + 5 `test_adversarial`: empty selection,
  over-budget/invalid season, duplicates/unknown on runs path, API-level
  seed determinism, 405/404 surface).
- vitest 6/6, `tsc` clean, `next build` green.
- a11y: native controls throughout, named icon buttons, labelled search,
  `role=status/alert` + `aria-live` on async states, global 2px
  `:focus-visible` outline, keyboard activation e2e-covered. No
  axe-grind: interaction patterns are native, audited by inspection.
- Builder + results footers carry the limitations disclaimer (copy reviewed).
- Deploy: `backend/Dockerfile` + `.dockerignore` + `docs/DEPLOY.md`
  (pre-flight checklist, env recap, RAM/storage notes). LIMIT: Docker
  Desktop daemon was down on this machine, so image build is unverified —
  Dockerfile mirrors the verified local env (same pins, PYTHONPATH, data).
  Targets themselves are unprovisioned by decision.
- Data verification: Madring homologation confirmed (FIA approval 2026-06-23,
  inaugural GP held 2026-09-11/13) — `fia_license_grade` set to 1 with
  provenance note; expiry still null. Zandvoort expiry remains the single
  unverified cell, flagged in-file.

## MVP acceptance (01 §8) — all met
- 20–24 race scenarios constructible; invalid ones rejected with actionable
  diagnostics (codes, not prose).
- Feasible scenarios produce validator-clean calendars (pipeline guarantee
  + API contract test + live e2e).
- Reproducible under fixed seed (backend + API determinism tests).
- Route/metrics agree with schedule (segment-race consistency test).
- Workflow understandable without technical knowledge (gated button states,
  plain-language errors, honest wait-time note).

## Artifacts
`e2e/{flow,map}.spec.ts`, `playwright.config.ts`, `tests/test_adversarial.py`,
`backend/{Dockerfile,.dockerignore}`, `docs/DEPLOY.md`, builder footer,
focus-visible CSS, Madring dataset update.

## Post-MVP (02 roadmap, untouched)
V1.1 practical scheduling → V1.2 carbon/logistics → V1.3 persistence/exports
→ V2 decision support. Async jobs only on measured need (sync P95 ≤ 20s holds).
