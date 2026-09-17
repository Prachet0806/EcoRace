# Phase 0 Gate Report — CLOSED 2026-09-17

## Versions (docs/VERSIONS.md)
python 3.11.9, node v22.19.0, next 16.3.5, zustand 5.0.15,
maplibre-gl 6.10.0, fastapi 0.128.2, pydantic 2.12.5, ortools 9.15.6755.

## Contracts frozen
P0-01/P0-02 horizon (Friday-id, Mar1→Dec1 rule, 40 weekends 2025+2026),
P0-03 exact-match, P0-04 weather matrix, P0-05 venue library
(`fia-grade1-2026-03-31+f1-2020-2026`, 42 routing venues: 35 Grade 1 +
sochi/istanbul/suzuka/shanghai/austin/mexico_city/madring from F1 2020-2026;
Dubai configs collapsed; zandvoort expiry null pending PDF verification),
P0-06 Haversine
R=6371.0088, P0-07 greedy baseline (BASELINE_INFEASIBLE≠scenario-infeasible),
P0-08 sync+30s timeout, P0-09 shape benchmark, P0-10/11 MapLibre+sync ids,
P0-12 FORMULATION.md (x/r/y, AddCircuit/MTZ note).
ADR-FE-001..005 frozen.

## Evidence
- pytest: 13 passed (test_horizon + test_phase0_contracts incl. venue-union test).
- Benchmark: docs/BENCHMARK_P0.json — 20/22/24 baselines 137,698 / 153,024 / 165,280 km; <2ms greedy.
- Health stub: {"status": "ok"}.
- Forbidden deps: domain+analytics clean; fetch only in lib/api-client.ts.
- Frontend: tsc clean, `next build` green (routes /ecorace, /ecorace/results/[runId]).

## Artifacts
data/circuits.json (FIA+F1 wrapper, 42 venues), data/seasons/2025.json + 2026.json,
data/weather/weather-v1.json, data/emission_factors.json (stub),
data/DATASET_VERSION, docs/FORMULATION.md, docs/adr/*, docs/BENCHMARK_P0.json.

## Boundary to Phase 1
OR-Tools solver + heuristics + pipeline. No redefining weekend/baseline/weather/distance.
