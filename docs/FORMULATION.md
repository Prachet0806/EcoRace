# P0-12 — Formal Optimization Formulation (frozen, implement in Phase 1)

## Sets / inputs
- `C`: selected circuits, `|C| = N`, `20 ≤ N ≤ 24` (exact-match, P0-03).
- `W`: season weekends in horizon order, `|W| = 40` (2025/2026), id = Friday date.
- `F ⊆ C × W`: weather-feasible pairs (`WeatherPolicy.is_feasible`).
- `d: C × C → ℝ≥0`: Haversine km matrix (P0-06), float, precomputed once.

## Decision variables
- `x[c,w] ∈ {0,1}`: 1 iff circuit `c` assigned to weekend `w`.
- `r[w] ∈ {0,1}`: 1 iff weekend `w` holds a race.
- `y[c1,c2] ∈ {0,1}` (or CP-SAT circuit successor vars): 1 iff `c2` is the
  immediate successor race of `c1` in calendar order. Exactly `N-1` of these are 1
  and they form a single Hamiltonian path over `C` consistent with weekend order.

Assignment alone cannot express routing cost — `y` (or equivalent
successor/circuit encoding) is mandatory.

## Constraints
1. `Σ_w x[c,w] = 1 ∀c` (each circuit exactly once).
2. `Σ_c x[c,w] ≤ 1 ∀w`, `r[w] = Σ_c x[c,w]` (≤1 race/weekend).
3. `Σ_w r[w] = N`.
4. `x[c,w] = 0 ∀(c,w) ∉ F` (weather hard).
5. `r[w]+r[w+1]+r[w+2]+r[w+3] ≤ 3` for every 4 consecutive weekends (I7/I8).
6. Path consistency: `y` links assignments so that if `x[c1,w1]=x[c2,w2]=1`
   with no occupied weekend between `w1,w2`, then the corresponding
   successor relation holds; indegree ≤ 1, outdegree ≤ 1, no subtours
   (MTZ or CP-SAT `AddCircuit` over an expanded graph with depot).

## Objective
`min Σ_{c1≠c2} d(c1,c2)·y[c1,c2]` — total great-circle route distance.

## Output extraction
Ordered races = assignments sorted by weekend; `Calendar{weekends, assignment}`;
validate with independent `SolutionValidator` (streak, uniqueness, weather,
count) before metrics. Record solver/version/seed/time-limit/data-version.
Deterministic under fixed seed+input to solver's guarantee level.

## Phase 1 implementation note
Translator lives in `optimization/` (domain never imports OR-Tools).
Heuristic (nearest-neighbor + 2-opt) provides incumbent + fallback.

## Implementation addendum (Phase 1, frozen math unchanged)

The solver encodes adjacency with sequence variables instead of explicit
`y[c1,c2]` + circuit/subtour machinery, because calendar time-order makes the
route a DAG:

- `s[k] ∈ [0,N)`, `AllDifferent` — k-th race's circuit (k = 0..N-1 in time order).
- `t[k] ∈ [0,W)`, strictly increasing — k-th race's weekend index.
- Streak: `t[k+3] − t[k] ≥ 4` (equality would mean 4 consecutive occupied weekends).
- Weather: `AddAllowedAssignments([s[k], t[k]], feasible (circuit, weekend) pairs)`.
- Cost: `idx[k] = s[k]·N + s[k+1]` (linear, N const) + `AddElement`
  over the flattened integer-meters matrix, `min Σ cost[k]`.
  (An earlier reified `z[k][i][j]` encoding stalled presolve with zero
  search progress — replaced, same objective.)
- Presolve OFF (`cp_model_presolve=False`): Probe expands the table/element
  encoding into 20k booleans / 1.2M clauses and never reaches search within
  MVP budgets (measured P1). The model is tight by construction
  (feasible hint + `t[k] ∈ [k, W−N+k]` bounds), so solve directly.
- Hint discipline: hint `s[k]` AND `t[k]` from ONE feasible calendar's time
  order. Mixed-source hints (order from A, weekends from B) are infeasible
  and poison the search (measured P1).

Channeling to the frozen variables: `x[c,w] = 1 ⟺ ∃k: s[k]=c ∧ t[k]=w`,
`r[w] = Σ_c x[c,w]`. Same feasible set, same objective values — an encoding
choice, not a model change. `SolutionValidator` checks the extracted
`Calendar` against constraints 1–5 independently of this encoding.
