# EcoRace Planner

**A decision-support platform for optimizing the F1 calendar for sustainability and logistics efficiency.**

EcoRace Planner constructs, evaluates, and optimizes race calendars under explicit scheduling, weather, and logistics constraints.

## Documentation

1. [Product Requirements Document](01_PRD.md)
2. [Scope and Roadmap](02_SCOPE_AND_ROADMAP.md)
3. [Architectural Design](03_ARCHITECTURAL_DESIGN.md)
4. [Domain Model](04_DOMAIN_MODEL.md)
5. [Invariants and Constraints](05_INVARIANTS_AND_CONSTRAINTS.md)
6. [Optimization Model](06_OPTIMIZATION_MODEL.md)
7. [Data Model](07_DATA_MODEL.md)
8. [API Contract](08_API_CONTRACT.md)
9. [Frontend Design](09_FRONTEND_DESIGN.md)
10. [Analytics and Metrics](10_ANALYTICS_AND_METRICS.md)
11. [Testing and Validation](11_TESTING_AND_VALIDATION.md)
12. [Non-Functional Requirements](12_NON_FUNCTIONAL_REQUIREMENTS.md)
13. [Limitations and Assumptions](13_LIMITATIONS_AND_ASSUMPTIONS.md)

## Core architectural principle

> The optimization core must be executable as a standalone Python library with no HTTP server, database, frontend, or external service running.

The system is a modular monolith initially. Storage, HTTP, weather providers, and solver implementations are adapters around a domain and optimization core.

## Current MVP concept

The MVP is a web application with a scenario-builder page and a dedicated optimization-results route.

The initial scheduling problem is intentionally small:

- Horizon: first weekend of March through first weekend of December, inclusive.
- Calendar size: 20–24 races.
- At most one race per weekend.
- A race weekend is Friday–Sunday.
- Weather feasibility is a hard constraint.
- Maximum of 3 consecutive race weekends, followed by at least 1 weekend off.
- Each selected circuit appears exactly once.
- Initial optimization objective: minimize total travel distance.

Carbon, regional grouping, historical preservation, disruption robustness, and advanced logistics are later extensions.
