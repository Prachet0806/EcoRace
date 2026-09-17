# Domain Model

## 1. Core entities

### Circuit

```python
@dataclass(frozen=True)
class Circuit:
    id: CircuitId
    name: str
    country: str
    city: str
    region: Region
    latitude: float
    longitude: float
```

### RaceWeekend

A scheduling unit representing Friday, Saturday, and Sunday.

```python
@dataclass(frozen=True)
class RaceWeekend:
    id: WeekendId
    friday: date
    saturday: date
    sunday: date
```

A valid weekend satisfies:

```text
Saturday = Friday + 1 day
Sunday   = Friday + 2 days
```

### Race

```python
@dataclass(frozen=True)
class Race:
    circuit_id: CircuitId
    weekend_id: WeekendId
    locked: bool = False
```

### ScheduledWeekend

```python
@dataclass(frozen=True)
class ScheduledWeekend:
    weekend: RaceWeekend
    race: Race | None
```

`race is None` means the weekend is a break.

### Calendar

The calendar is a first-class aggregate.

```python
@dataclass(frozen=True)
class Calendar:
    weekends: tuple[ScheduledWeekend, ...]
```

Responsibilities:

- validate weekend structure;
- count races;
- identify occupied weekends;
- identify breaks;
- calculate consecutive-race streaks;
- expose ordered races.

### Scenario

A scenario captures the user's requested optimization problem.

```text
Scenario
├── selected circuits
├── race count
├── horizon
├── constraints
├── objective configuration
└── solver configuration
```

### OptimizationResult

```text
OptimizationResult
├── status
├── input scenario
├── optimized calendar
├── metrics
├── constraint results
├── solver metadata
└── diagnostics
```

## 2. Weather model

A weather profile represents the weather information available for a circuit over scheduling periods.

MVP only requires the ability to determine:

```text
Circuit × Weekend → feasible / infeasible
```

The source/provider is outside the domain.

## 3. Constraint model

```python
class Constraint(Protocol):
    @property
    def name(self) -> str: ...

    def evaluate(self, calendar: Calendar) -> ConstraintResult: ...
```

A constraint should express domain semantics rather than solver syntax.

## 4. Value objects

Candidates include:

- `CircuitId`;
- `WeekendId`;
- `Region`;
- `RaceCount`;
- `DateRange`;
- `Distance`;
- `CarbonAmount`;
- `ConstraintResult`;
- `Violation`;
- `ObjectiveWeight`.

Value objects should validate their own basic invariants.

## 5. Aggregate boundaries

`Calendar` is the primary scheduling aggregate.

`Scenario` owns the configuration required to produce a calendar.

The optimization engine should consume immutable problem representations and return immutable results.
