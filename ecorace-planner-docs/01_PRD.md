# Product Requirements Document

## 1. Product

**Name:** EcoRace Planner

**Tagline:** A decision-support platform for optimizing the F1 calendar for sustainability and logistics efficiency.

## 2. Product vision

EcoRace Planner allows a user to construct a candidate F1 calendar and explore how different scheduling choices affect geographical travel, sustainability, and logistics efficiency.

The product should expose tradeoffs rather than present a single universally correct calendar.

## 3. Problem statement

An F1 calendar is a sequence of geographically distributed events. Reordering events can materially change the amount and structure of travel required between races. However, arbitrary geographic optimization can create schedules that violate practical calendar rules or weather feasibility.

EcoRace Planner addresses this as a constrained optimization problem.

## 4. Primary user workflow

1. Choose the number of races: 20–24.
2. Select circuits from the circuit library.
3. Configure the initial constraints.
4. Submit the scenario.
5. Validate feasibility.
6. Optimize the calendar.
7. View the resulting calendar, route, and metrics.
8. Modify the scenario and run another optimization.

## 5. MVP requirements

### Track selection

- Display available circuits in a scrollable right-hand panel.
- Sort available circuits alphabetically.
- Allow track search.
- Selecting a circuit moves it to the selected left-hand panel.
- Selected circuits disappear from the available panel.
- Deselecting a circuit removes it from the selected panel and returns it to its alphabetical position in the available panel.
- Selection state has one source of truth.

### Calendar configuration

- Race count must be configurable from 20 through 24.
- The scheduling horizon is the first weekend of March through the first weekend of December, inclusive.
- Each weekend is a scheduling unit.
- A weekend is either occupied by one race or is a break.

### Constraints

- At most one race per weekend.
- Race weekends consist of Friday, Saturday, and Sunday.
- Weather feasibility is enforced.
- No more than 3 consecutive race weekends.
- After a sequence of 3 consecutive race weekends, at least 1 weekend must be off.
- Each selected circuit is used exactly once.
- The scenario must contain enough selected circuits for the configured race count.

### Optimization

The initial objective is minimizing total travel distance between consecutive races.

### Results

The result view should provide:

- optimized calendar timeline;
- route visualization;
- total travel distance;
- race and break counts;
- constraint status;
- baseline comparison where a meaningful baseline is available;
- travel-leg details.

## 6. V2 requirements

V2 expands the optimizer into a decision-support platform.

Potential V2 capabilities:

- locked/fixed races;
- minimum logistics turnaround;
- explicit summer break;
- must-include/must-exclude circuits;
- regional grouping preferences;
- transport-mode modeling;
- carbon estimation;
- distance/carbon weighted objectives;
- historical calendar preservation;
- scenario persistence;
- scenario comparison;
- sensitivity analysis;
- robustness and disruption simulation;
- richer explainability;
- asynchronous optimization jobs where runtime requires it.

V2 features are not automatically hard constraints. Each feature must be classified as an invariant, hard constraint, soft constraint, objective, or analysis capability.

## 7. Non-goals

The product does not attempt to model:

- exact team cargo manifests;
- promoter contracts or commercial negotiations;
- detailed personnel fatigue;
- exact official F1 emissions accounting;
- operationally authoritative freight schedules;
- exact airport, customs, or carrier operations.

## 8. Success criteria

The MVP is successful when:

- a user can construct a 20–24 race scenario;
- invalid scenarios are rejected with actionable diagnostics;
- feasible scenarios produce valid calendars;
- all returned calendars satisfy hard constraints;
- the optimization is reproducible under a fixed configuration and seed;
- route and metric calculations agree with the underlying schedule;
- the UI makes the scenario → optimization → result workflow understandable without technical knowledge.
