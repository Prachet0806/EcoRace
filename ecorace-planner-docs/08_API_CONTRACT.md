# API Contract

## 1. Principles

The API is an adapter around application use cases.

It must not contain:

- optimization algorithms;
- domain rule implementations;
- SQL;
- weather-provider logic.

## 2. Initial endpoints

### GET `/api/v1/circuits`

Returns the circuit library.

### POST `/api/v1/scenarios`

Creates/validates a scenario.

### POST `/api/v1/optimization/runs`

Runs an optimization for a scenario.

### GET `/api/v1/optimization/runs/{run_id}`

Retrieves a completed optimization result.

### GET `/api/v1/health`

Health check.

## 3. Scenario request

Conceptual shape:

```json
{
  "race_count": 20,
  "circuit_ids": ["bahrain", "suzuka", "monaco"],
  "horizon": {
    "start": "first_weekend_of_march",
    "end": "first_weekend_of_december"
  },
  "constraints": {
    "weather": true,
    "max_consecutive_race_weekends": 3
  },
  "objective": {
    "type": "distance"
  }
}
```

The example circuit list is illustrative; a valid request must contain enough circuits for the requested race count.

## 4. Optimization response

Conceptual shape:

```json
{
  "run_id": "run_123",
  "status": "feasible",
  "calendar": [],
  "metrics": {
    "total_distance_km": 0
  },
  "constraints": [],
  "solver": {
    "name": "ortools",
    "runtime_ms": 0
  }
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
