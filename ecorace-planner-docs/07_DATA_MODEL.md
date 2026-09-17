# Data Model

## 1. Data categories

EcoRace Planner separates:

```text
Reference data
Application data
Derived data
External data
```

## 2. Reference data

MVP can use version-controlled JSON.

### Circuits

```json
{
  "id": "suzuka",
  "name": "Suzuka Circuit",
  "country": "Japan",
  "city": "Suzuka",
  "region": "Asia",
  "latitude": 34.8431,
  "longitude": 136.5419
}
```

### Weekend definitions

Generated from the configured season horizon rather than manually stored.

### Weather

Weather data should be versioned and normalized into a form suitable for feasibility evaluation.

## 3. Derived data

The following can be calculated rather than persisted:

- distance matrix;
- route legs;
- race streaks;
- break count;
- constraint results;
- summary metrics.

Distance matrices may be cached when computation is expensive.

## 4. Application persistence

MVP does not require a database for the optimization core.

Recommended progression:

```text
MVP:
JSON reference data

Saved scenarios:
SQLite

Multi-user / concurrent deployment:
PostgreSQL
```

The repository interface must remain stable across storage implementations.

## 5. Scenario persistence

A persisted scenario should include:

- scenario ID;
- selected circuits;
- race count;
- horizon;
- constraint configuration;
- objective configuration;
- data version;
- creation timestamp.

## 6. Optimization run persistence

A run should include:

- run ID;
- scenario ID;
- solver configuration;
- status;
- runtime;
- seed;
- result;
- metric snapshot;
- diagnostic metadata.

## 7. Storage independence

Domain entities must not depend on ORM models.

```text
Database row
    ↓
Repository adapter
    ↓
Domain entity
```

not:

```text
Domain entity → SQLAlchemy model
```
