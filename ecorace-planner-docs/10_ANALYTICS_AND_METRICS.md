# Analytics and Metrics

## 1. Principles

Metrics evaluate schedules. They should be calculated from the schedule and data, not embedded inside the solver.

## 2. MVP metrics

### Total travel distance

Sum of distances between consecutive race locations.

### Race count

Number of occupied weekends.

### Break count

Number of unoccupied weekends within the horizon.

### Race streaks

Lengths of consecutive occupied-weekend sequences.

### Constraint status

For each hard constraint:

- satisfied;
- violated;
- violation count;
- affected items.

## 3. Baseline

A baseline is represented as an ordinary schedule rather than a special analytics object.

Possible baseline sources:

- current/official calendar;
- user-provided calendar;
- initial constructed ordering.

Both baseline and optimized schedules pass through the same evaluator.

## 4. Comparison

Comparison should expose factual differences:

```text
Metric              Baseline       Optimized
------------------------------------------------
Travel distance     ... km         ... km
Race weekends       ...            ...
Break weekends      ...            ...
Weather violations  ...            0
Max streak          ...            ...
```

Avoid presenting a composite score unless its definition is explicit.

## 5. Future sustainability metrics

V2 can introduce:

- estimated transport emissions;
- emissions by transport mode;
- emissions per race;
- emissions saved relative to baseline;
- intercontinental transitions;
- regional transition count.

Carbon outputs must be labeled as estimates.

## 6. Future logistics metrics

Potential metrics:

- road-travel distance;
- air-travel distance;
- intercontinental transitions;
- logistics complexity;
- turnaround pressure;
- regional clustering.

## 7. Explainability

The analytics layer should provide factual explanations such as:

- why a race was assigned to a particular weekend;
- which alternatives were infeasible;
- which constraints prevented a shorter route;
- which route legs dominate total travel.

The system must base explanations on recorded model/data facts rather than fabricated solver reasoning.
