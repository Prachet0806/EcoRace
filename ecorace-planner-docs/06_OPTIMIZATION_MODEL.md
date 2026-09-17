# Optimization Model

## 1. Initial problem

Given:

- a set of selected circuits;
- a sequence of available weekends;
- a requested race count between 20 and 24;
- weather feasibility;
- maximum three consecutive race weekends;

construct a valid calendar minimizing travel distance.

## 2. Decision variables

A simple formulation uses assignment variables:

```text
x[c,w] = 1 if circuit c is assigned to weekend w
         0 otherwise
```

and occupancy variables:

```text
r[w] = 1 if weekend w contains a race
       0 otherwise
```

## 3. Circuit assignment

Every selected circuit is assigned exactly once:

```text
Σ_w x[c,w] = 1
```

for each circuit `c`.

## 4. Weekend occupancy

At most one circuit is assigned to a weekend:

```text
Σ_c x[c,w] <= 1
```

and:

```text
r[w] = Σ_c x[c,w]
```

## 5. Race count

For an exact scenario race count `N`:

```text
Σ_w r[w] = N
```

with:

```text
20 <= N <= 24
```

## 6. Weather

If circuit `c` is not feasible in weekend `w`:

```text
x[c,w] = 0
```

Weather feasibility can therefore be represented as an allowed-assignment matrix.

## 7. Consecutive-race constraint

For every four consecutive weekends:

```text
r[w] + r[w+1] + r[w+2] + r[w+3] <= 3
```

This prevents four consecutive race weekends.

## 8. Objective

The initial objective is total route distance.

For ordered race assignments:

```text
minimize Σ distance(c_i, c_j)
```

for each pair of consecutive races in the resulting calendar.

The implementation may use a routing formulation or an assignment/sequence formulation depending on the chosen solver architecture.

## 9. Solver abstraction

```python
class CalendarSolver(Protocol):
    def solve(self, problem: OptimizationProblem) -> SolverResult:
        ...
```

Implementations may include:

- `ORToolsSolver`;
- `HeuristicSolver`.

## 10. Heuristic fallback

Candidate heuristics:

- nearest neighbor;
- 2-opt;
- 3-opt;
- regional clustering;
- swap-based improvement.

A heuristic solution must still pass the same domain validator.

## 11. Optimization pipeline

```text
Precheck
   ↓
Build optimization problem
   ↓
Generate initial solution
   ↓
Solve
   ↓
Improve
   ↓
Validate
   ↓
Evaluate metrics
   ↓
Return result
```

## 12. Determinism

For reproducibility, optimization should record:

- solver;
- solver version;
- configuration;
- random seed;
- time limit;
- input dataset version.

A fixed seed and fixed input should produce reproducible behavior to the extent guaranteed by the selected solver.
