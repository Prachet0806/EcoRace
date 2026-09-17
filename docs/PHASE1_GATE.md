# Phase 1 Gate Report — CLOSED 2026-09-17

## Scope
OR-Tools CP-SAT solver + NN/2-opt heuristic + `optimize()` pipeline +
independent `SolutionValidator`. Standalone: no HTTP/DB/frontend.
Phase 0 contracts untouched (weekend/baseline/weather/distance identical).

## Evidence
- pytest: 21/21 pass (13 Phase 0 + 8 `test_optimization`: feasible 20/22/24
  beating baseline, blocked-circuit INFEASIBLE, weather/streak adherence,
  seed determinism, typed timeout, heuristic validity, planted-violation
  detection, horizon-edge triple).
- Forbidden deps: `optimization/` has no fastapi/sqlalchemy; `domain/` has
  no ortools; frontend `fetch()` only in `lib/api-client.ts`.
- Benchmark (`docs/BENCHMARK_P1.json`, config 5s x seeds 0,1,2):
  - n=20: 48,196 km (baseline 137,698, saving 65%), wall 15.2s
  - n=22: 48,674 km (baseline 153,024, saving 68%), wall 15.8s
  - n=24: 49,041 km (baseline 165,280, saving 70%), wall 17.1s
  - All `feasible_timeout` (optimality NOT_PROVEN, honestly marked per P0-08).

## Measured solver findings (all in FORMULATION.md addendum)
1. Quality is NOT monotone in time limit (30s run worse than 5s, same seed).
   Response: deterministic seed portfolio (0,1,2) + keep-best validator-clean.
2. Reified z-encoding + presolve Probe (20k bools/1.2M clauses) = zero search.
   Response: element-lookup costs + `cp_model_presolve=False` + tight
   `t[k]` bounds. Search starts immediately.
3. Mixed-source hints poison search. Response: hint s[k]+t[k] from one
   feasible calendar's time order.
4. Heuristic parity: NN+2opt ties OR-Tools at MVP budgets; search mobility
   proven (165k baseline hint -> 117k in 8s). Solver adds robustness +
   optimality framework; keep-best takes either origin.

## MVP sync target (set from measurement, P0-09)
- P95 wall <= 20s at default config (5s x 3 seeds + heuristic).
- `SOLVER_TIMEOUT_SECONDS` env lands in Phase 3 (default 30s ceiling).

## Artifacts
`optimization/{model,validator,heuristics,ortools_solver,pipeline}.py`,
`tests/test_optimization.py`, `tests/bench_p1.py`, `docs/BENCHMARK_P1.json`,
`docs/FORMULATION.md` (implementation addendum).

## Boundary to Phase 2 (Application + API)
DTOs, routes, CORS, in-memory runs, error codes. No solver/model changes
expected; `optimize()` is the interface.
