# API Contract

## 1. Principles

The API is an adapter around application use cases.

It must not contain:

- optimization algorithms;
- domain rule implementations;
- SQL;
- weather-provider logic.

## 2. Current public endpoints

### GET `/api/v1/circuits`

Returns the circuit library.

### POST `/api/v1/optimization/runs`

Validates a scenario and runs an optimization. The complete scenario and run
are stored atomically after a successful solve.

### GET `/api/v1/optimization/runs/{run_id}`

Retrieves a completed optimization result.

### GET `/api/v1/health`

Health check.

### GET `/api/v1/seasons/{year}/weekends`

Returns the planning horizon. There are no public list or delete routes for
scenarios and runs in the anonymous demo.

## 3. Scenario request

Current request shape (the circuit list is abbreviated here):

```json
{
  "race_count": 20,
  "circuit_ids": ["bahrain", "suzuka", "monaco"],
  "season_year": 2026,
  "max_consecutive": 3,
  "summer_break_start": 19,
  "summer_break_end": 21,
  "pin_end_to_dec_week1": false,
  "seed": 0,
  "budget_s": 30
}
```

The example circuit list is illustrative; a valid request contains exactly
`race_count` distinct known IDs. The finale pin targets the final horizon
weekend, which does not always have a December Friday. Unsupported request
fields (including custom `constraints` and `objective`) return 422; they are
never silently ignored.

## 4. Optimization response

Conceptual shape:

```json
{
  "run_id": "run_123",
  "status": "feasible",
  "calendar": {"races": [], "breaks": []},
  "metrics": {
    "total_distance_km": 0,
    "baseline_status": "non_comparable:MONTHLY_MINIMUM_VIOLATION",
    "saving_km": null
  },
  "constraints": [],
  "solver": {
    "name": "ortools",
    "runtime_ms": 0
  },
  "provenance": {"weather_version": "weather-v1", "weather_synthetic": true,
    "scenario": {}, "requested_budget_s": 30, "seed_schedule": [0, 1, 2]}
}
```

## 5. Error model

Errors should be machine-readable.

```json
{
  "error": {
    "code": "SCENARIO_INFEASIBLE",
    "message": "No feasible calendar satisfies the configured constraints.",
    "details": []
  }
}
```

Potential codes:

- `INVALID_RACE_COUNT`;
- `INSUFFICIENT_CIRCUITS`;
- `DUPLICATE_CIRCUIT`;
- `INVALID_HORIZON`;
- `SCENARIO_INFEASIBLE`;
- `SOLVER_TIMEOUT`;
- `SOLVER_FAILURE`;
- `DATA_UNAVAILABLE`.

## 6. Versioning

API paths should be versioned from the beginning:

```text
/api/v1/...
```

## 7. Contract separation

HTTP schemas are not domain entities.

```text
HTTP Request DTO
      ↓
Application command
      ↓
Domain model
```

and:

```text
Domain result
      ↓
Application result
      ↓
HTTP response DTO
```
