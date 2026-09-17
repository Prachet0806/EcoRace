# Non-Functional Requirements

## 1. Correctness

Hard constraints must never be violated by a result marked feasible.

## 2. Determinism

Runs should record configuration and random seed. Deterministic operation should be the default where practical.

## 3. Performance

MVP optimization should complete interactively for ordinary scenarios. Exact performance targets should be established after benchmarking realistic problem sizes.

Do not introduce distributed job infrastructure before measurements demonstrate the need.

## 4. Maintainability

Modules must have explicit responsibilities.

The domain must remain framework independent.

The optimization engine must remain callable without HTTP or persistence.

## 5. Reliability

A failed solver run must not be represented as a successful calendar.

Partial or stale optimization results must be distinguishable from completed results.

## 6. Observability

Optimization runs should record:

- run ID;
- scenario ID;
- solver;
- runtime;
- seed;
- status;
- objective value;
- validation status;
- major diagnostics.

## 7. Security

MVP does not require sensitive user data.

If accounts and saved scenarios are introduced:

- authenticate access to private scenarios;
- authorize scenario reads/writes;
- validate all inputs server-side;
- never trust frontend constraint values.

## 8. Accessibility

The frontend should support:

- keyboard navigation;
- visible focus states;
- accessible labels;
- sufficient contrast;
- screen-reader-compatible controls.

## 9. Browser behavior

The application should support modern desktop browsers for MVP. Mobile should prioritize readable results and basic scenario inspection before full editing parity.

## 10. Deployment

MVP can use:

```text
Frontend hosting
+
FastAPI backend
+
version-controlled reference data
```

A database is optional until persistence requirements justify it.
