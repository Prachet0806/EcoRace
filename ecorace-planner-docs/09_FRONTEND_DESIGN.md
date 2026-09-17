# Frontend Design

## 1. MVP UX

The MVP is a single-page scenario builder with a dedicated results route.

```text
/ecorace
    ↓
/ecorace/results/{run_id}
```

## 2. Scenario builder

The builder contains:

1. track selection;
2. calendar configuration;
3. constraint configuration;
4. optimization action.

## 3. Track selector

Two panels:

```text
LEFT                         RIGHT
Selected                     Available
```

### Right panel

- scrollable;
- alphabetically ordered;
- searchable;
- contains only unselected circuits.

### Left panel

- contains selected circuits;
- each item has a deselect/remove action;
- selection order may be preserved for future calendar-building features.

### Selection behavior

Selecting:

```text
Available → Selected
```

and removes the track from the available list.

Deselecting:

```text
Selected → Available
```

and the track reappears at its alphabetical position.

## 4. Single source of truth

Do not maintain independent left/right arrays.

Maintain:

```typescript
selectedTrackIds: Set<TrackId>
```

Derive both lists from the canonical circuit collection.

## 5. Constraint panel

MVP controls:

```text
Race count: 20–24
Weather: enabled
Max consecutive race weekends: 3
Horizon: Mar W1 → Dec W1
```

Avoid exposing internal solver parameters in the primary UI.

## 6. Optimization interaction

The primary action is:

```text
Optimize Calendar
```

During optimization, show:

- validation;
- optimization state;
- progress/status where available;
- errors or infeasibility diagnostics.

## 7. Results route

Results should have dedicated screen real estate for:

- summary metrics;
- optimized calendar;
- route map;
- baseline comparison;
- constraint diagnostics;
- travel legs.

A back action should return to the scenario builder while preserving the scenario.

## 8. Component structure

```text
features/
├── circuits/
│   ├── TrackSelector
│   ├── AvailableTrackList
│   ├── SelectedTrackList
│   ├── TrackListItem
│   └── useTrackSelection
├── constraints/
│   └── ConstraintPanel
├── optimization/
│   ├── OptimizeButton
│   └── OptimizationStatus
└── results/
    ├── ResultsPanel
    ├── CalendarTimeline
    ├── RouteMap
    └── MetricsDashboard
```

## 9. State separation

Separate:

- server state;
- scenario editing state;
- result state;
- transient UI state.

Components should not own API transport logic.

## 10. UX principle

The core mental model should be:

```text
Select → Configure → Optimize → Inspect
```

The interface should expose the optimization problem without requiring the user to understand the underlying mathematical formulation.
