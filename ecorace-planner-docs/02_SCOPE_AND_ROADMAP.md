# Scope and Roadmap

## 1. Scope philosophy

EcoRace Planner should grow by adding one well-defined capability at a time. New features must not weaken existing domain invariants or couple the optimizer to infrastructure.

## 2. MVP

### Included

- Circuit library
- Alphabetical available-track list
- Selected/available two-pane interaction
- Race count 20–24
- March W1 → December W1 horizon
- Weekend-based scheduling
- One race per weekend
- Friday–Sunday weekend definition
- Weather feasibility
- Maximum 3 consecutive race weekends
- Required break after 3 consecutive weekends
- Unique circuit assignment
- Distance minimization
- Baseline evaluation
- Optimized result
- Interactive route map
- Calendar timeline
- Basic metrics
- Feasibility diagnostics

### Explicitly excluded

- Carbon optimization
- Detailed transport network
- Sea freight
- Promoter contracts
- Personnel fatigue
- Stochastic optimization
- Pareto optimization
- Multi-user collaboration
- Full user-account system
- Advanced scenario history
- Production-scale job orchestration

## 3. Post-MVP / V1.x

### V1.1 — Practical scheduling

- Locked races
- Minimum turnaround
- Explicit summer break
- Must-include and must-exclude circuits
- Better infeasibility diagnostics

### V1.2 — Logistics and sustainability

- Transport mode classification
- Carbon estimation
- Regional grouping preference
- Logistics complexity metric
- Distance + carbon objective

### V1.3 — Productization

- Saved scenarios
- Saved optimization runs
- Shareable result URLs
- Export JSON/CSV/PDF
- Optimization metadata
- Solver/runtime diagnostics

## 4. V2

### V2.0 — Decision support

- Side-by-side scenario comparison
- Sensitivity analysis
- Optimization profiles
- Historical-order preservation
- Adjustable objective weights
- Advanced constraint configuration

### V2.1 — Robustness

- Disruption simulation
- Weather disruption scenarios
- Cargo-delay scenarios
- Circuit unavailability
- Recovery-cost analysis
- Monte Carlo experiments

### V2.2 — Research-grade optimization

- Multi-objective optimization
- Pareto frontier
- Robust optimization
- Alternative solver strategies
- Benchmark suite
- Solver quality/runtime comparison

## 5. Future knobs

Candidate knobs include:

### Calendar
- race count;
- maximum consecutive weekends;
- minimum break;
- summer break;
- season start/end;
- double-header policy.

### Weather
- temperature thresholds;
- precipitation thresholds;
- weather strictness;
- historical-climatology policy;
- weather confidence.

### Logistics
- regional grouping strength;
- intercontinental transition penalty;
- minimum turnaround;
- transport mode;
- mode-specific turnaround.

### Sustainability
- distance weight;
- carbon weight;
- logistics weight;
- calendar-disruption weight.

### Calendar preservation
- locked weekends;
- maximum allowed reorderings;
- historical-order penalty.

### Robustness
- disruption rate;
- scenario count;
- recovery objective;
- worst-case vs expected performance.

### Solver
- time limit;
- algorithm;
- random seed;
- solution-quality target.

## 6. Feature classification rule

Every new knob must answer:

1. Does it define what calendars are valid?
2. Does it express a preference among valid calendars?
3. Does it merely measure or explain the result?

The answers map to:

- invariant/hard constraint;
- soft constraint/objective;
- analytics/explanation.

Do not encode preferences as hard constraints without an explicit product decision.
