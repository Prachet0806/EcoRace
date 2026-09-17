# Invariants and Constraints

## 1. Purpose

This document defines rules that must remain true regardless of UI, solver, storage, or API implementation.

## 2. Hard invariants

### I1 — Valid race weekend

A race weekend consists of exactly:

```text
Friday
Saturday
Sunday
```

with consecutive dates.

### I2 — One race per weekend

A weekend contains zero or one race.

Double-headers are unsupported in MVP.

### I3 — Race count

For an optimization scenario:

```text
20 ≤ race_count ≤ 24
```

If the scenario selects exactly `N` circuits, then:

```text
number_of_races = N
```

for the MVP workflow.

### I4 — Season horizon

The scheduling horizon begins at the first weekend of March and ends at the first weekend of December, inclusive.

### I5 — Circuit uniqueness

A circuit can occur at most once in a calendar.

### I6 — Selected-circuit sufficiency

The scenario must provide exactly enough selected circuits for the configured race count under the MVP workflow.

### I7 — Consecutive race limit

No sequence of occupied weekends may exceed three.

Equivalently, for every four consecutive weekends:

```text
race_i + race_(i+1) + race_(i+2) + race_(i+3) <= 3
```

### I8 — Break after three races

If three consecutive weekends contain races, the following weekend must be a break when that following weekend exists within the horizon.

### I9 — Weather feasibility

A circuit may only be assigned to a weekend for which the configured weather policy considers the assignment feasible.

## 3. Constraint categories

### Hard constraints

MVP:

- weather;
- maximum consecutive weekends;
- race-count requirements;
- circuit uniqueness;
- weekend occupancy rules.

### Soft constraints

Not implemented in MVP, but intended for later use:

- regional grouping;
- historical-order preservation;
- calendar-disruption minimization.

### Objectives

MVP:

- total travel distance.

Later:

- estimated carbon;
- logistics complexity;
- regional transitions;
- calendar disruption;
- robustness.

## 4. Constraint result

```python
@dataclass(frozen=True)
class ConstraintResult:
    satisfied: bool
    violations: tuple[Violation, ...]
    penalty: float
```

A violation should identify:

- constraint;
- severity;
- affected race/circuit;
- affected weekend;
- human-readable message;
- machine-readable code.

## 5. Solver translation rule

Domain constraints must not contain OR-Tools calls.

Instead:

```text
Domain Constraint
        ↓
Constraint semantics
        ↓
Optimization Constraint Translator
        ↓
OR-Tools model
```

This preserves solver independence.

## 6. Infeasibility

A failed optimization should distinguish:

- invalid input;
- domain-invalid calendar;
- constraint infeasibility;
- solver failure;
- timeout;
- infrastructure failure.

The system should never return an apparently valid calendar that violates a hard constraint.
