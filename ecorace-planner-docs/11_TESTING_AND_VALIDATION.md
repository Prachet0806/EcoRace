# Testing and Validation

## 1. Testing philosophy

Every returned optimized calendar must pass domain validation independently of the solver.

The solver is not trusted merely because it reports success.

## 2. Unit tests

### Domain

Test:

- valid/invalid race weekends;
- race counts;
- circuit uniqueness;
- race/break representation;
- streak calculation.

### Constraints

Test:

- weather feasible assignment;
- weather infeasible assignment;
- three consecutive races;
- four consecutive races;
- required break after three races;
- one race per weekend.

### Analytics

Test:

- distance calculation;
- route-leg generation;
- baseline comparison;
- metric aggregation.

## 3. Property/invariant tests

Generate candidate calendars and assert:

```text
one race/weekend
20 <= race_count <= 24
no duplicate circuit
no four consecutive races
weather-feasible assignments only
weekend dates are Fri/Sat/Sun
```

## 4. Solver tests

Test:

- known feasible scenario;
- known infeasible scenario;
- weather-forbidden assignments;
- streak constraints;
- edge-of-horizon streak behavior;
- deterministic seed behavior;
- timeout behavior.

## 5. Integration tests

Test:

```text
HTTP → application → domain → optimizer → result
```

with infrastructure adapters.

## 6. Contract tests

Ensure:

- API request schemas match application commands;
- API responses match frontend expectations;
- error codes remain stable.

## 7. End-to-end tests

At minimum:

1. load circuit library;
2. select tracks;
3. deselect tracks;
4. configure race count;
5. run optimization;
6. display results;
7. return to scenario;
8. change configuration;
9. rerun.

## 8. Adversarial cases

Test:

- insufficient tracks;
- exactly 20 tracks;
- exactly 24 tracks;
- all possible weekends weather-infeasible for one circuit;
- impossible streak configuration;
- highly clustered circuits;
- globally distributed circuits;
- infeasibility caused by the combination of constraints.

## 9. Validation boundary

Use a final:

```text
SolutionValidator
```

after every solver implementation.

This makes heuristic and exact solvers subject to the same correctness standard.
