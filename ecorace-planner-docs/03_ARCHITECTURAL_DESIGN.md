# Architectural Design

## 1. Architecture style

EcoRace Planner uses a **modular monolith with hexagonal/ports-and-adapters principles**.

Microservices are intentionally deferred. The optimization engine remains independently executable so it can later be moved behind a worker or service boundary without changing the domain model.

## 2. Dependency direction

```text
Interface
    ↓
Application
    ↓
Domain
    ↓
Ports

Infrastructure implements ports.
Optimization depends on domain abstractions, not infrastructure.
```

Forbidden dependencies include:

- domain → FastAPI;
- domain → SQLAlchemy;
- domain → React;
- domain → OR-Tools;
- analytics → HTTP;
- frontend components → direct `fetch()` calls.

## 3. Layers

### Interface

Responsibilities:

- HTTP routing;
- request parsing;
- request schema validation;
- response serialization;
- HTTP status mapping.

No optimization logic.

### Application

Responsibilities:

- orchestrate use cases;
- load scenario inputs;
- invoke validation;
- construct optimization problems;
- run optimization;
- evaluate results;
- persist results where configured.

### Domain

Responsibilities:

- circuits;
- races;
- weekends;
- calendars;
- domain invariants;
- constraint semantics;
- scenarios.

Domain code should be framework independent.

### Optimization

Responsibilities:

- optimization problem representation;
- model construction;
- solver abstraction;
- OR-Tools adapter;
- heuristic fallback;
- prechecks;
- solution validation;
- optimization-specific explanation.

### Analytics

Responsibilities:

- distance metrics;
- carbon metrics;
- logistics metrics;
- schedule metrics;
- comparisons.

Analytics evaluates completed schedules; it does not determine feasibility unless explicitly part of a domain validator.

### Infrastructure

Responsibilities:

- JSON repositories;
- SQLite/PostgreSQL repositories;
- external weather adapters;
- solver adapters;
- persistence;
- configuration.

## 4. Backend structure

```text
backend/
└── src/ecorace/
    ├── interface/http/
    │   ├── routes/
    │   ├── requests/
    │   └── responses/
    ├── application/
    │   ├── scenarios/
    │   ├── optimization/
    │   └── analysis/
    ├── domain/
    │   ├── circuit/
    │   ├── calendar/
    │   ├── race/
    │   ├── constraints/
    │   ├── logistics/
    │   ├── sustainability/
    │   └── scenario/
    ├── optimization/
    │   ├── model/
    │   ├── solver/
    │   ├── algorithms/
    │   ├── pipeline/
    │   └── explanation/
    ├── analytics/
    ├── ports/
    └── infrastructure/
```

## 5. Core invariant

> The optimization core must be executable as a standalone Python library with no HTTP server, database, frontend, or external service running.

Conceptually:

```python
result = optimize(problem)
```

## 6. Optimization pipeline

```text
Optimization Request
        ↓
Input Validation
        ↓
Feasibility Pre-check
        ↓
Problem Builder
        ↓
Initial Solution
        ↓
Main Solver
        ↓
Improvement
        ↓
Solution Validator
        ↓
Analytics
        ↓
Result Builder
```

## 7. Frontend architecture

The frontend is a single-page application for scenario construction, with a dedicated results route.

```text
frontend/
└── src/
    ├── app/
    ├── features/
    │   ├── circuits/
    │   ├── constraints/
    │   ├── optimization/
    │   ├── scenarios/
    │   ├── analytics/
    │   └── comparison/
    ├── components/
    │   ├── map/
    │   ├── charts/
    │   ├── timeline/
    │   └── ui/
    ├── api/
    ├── domain/
    └── utils/
```

Component → feature hook/API → HTTP client is preferred over component-level HTTP calls.

## 8. Runtime evolution

### MVP

```text
React → FastAPI → Application → Domain/Optimization → JSON
```

### Persistence

```text
React → FastAPI → Application → Repository → SQLite
```

### Long-running optimization

Add a job boundary only when measured runtime requires it:

```text
FastAPI → Job Queue → Optimizer Worker
```

Redis/Celery or an equivalent stack is not part of the MVP.

### Scale

PostgreSQL is introduced only for genuine multi-user, concurrency, or analytics requirements.

## 9. Ports

Examples:

```python
class CircuitRepository(Protocol):
    def get_all(self) -> list[Circuit]: ...
    def get_by_id(self, id: CircuitId) -> Circuit: ...

class WeatherProvider(Protocol):
    def get_weather_profile(self, circuit_id: CircuitId) -> WeatherProfile: ...

class CalendarSolver(Protocol):
    def solve(self, problem: OptimizationProblem) -> SolverResult: ...
```

Adapters return domain objects rather than ORM objects.
