# Limitations and Assumptions

## 1. Purpose

EcoRace Planner is a decision-support and optimization model, not an authoritative representation of Formula 1 logistics operations.

## 2. Calendar assumptions

- The planning horizon begins at the first weekend of March.
- The planning horizon ends at the first weekend of December.
- Weekends are the atomic scheduling unit.
- Each weekend supports at most one race.
- Double-headers are not modeled in MVP.
- The configured calendar contains 20–24 races.

## 3. Weather assumptions

Weather feasibility is a model policy.

A weather-feasible assignment means the configured weather dataset/policy considers that circuit/weekend combination acceptable.

It does not guarantee actual race-day weather.

Long-range calendar planning should prefer appropriately aggregated or historical weather information rather than treating a short-range forecast as a year-long prediction.

## 4. Distance assumptions

Initial route distance is geographical distance between circuit locations.

Haversine or equivalent great-circle distance is an approximation and does not represent:

- actual road networks;
- airport routing;
- customs;
- freight corridors;
- carrier schedules.

## 5. Carbon assumptions

Future carbon estimates are modeled estimates.

They should not be described as official F1 emissions figures unless supported by authoritative data.

Emission results depend on assumptions including:

- cargo mass;
- transport mode;
- distance;
- emission factor;
- consolidation;
- routing.

## 6. Logistics assumptions

MVP does not model exact freight operations.

It does not know:

- team-specific cargo;
- exact shipment schedules;
- promoter contracts;
- customs arrangements;
- warehouse locations;
- staff travel;
- detailed fatigue.

## 7. Optimization limitations

An optimizer minimizes the objective supplied to it subject to the constraints supplied to it.

Therefore, a mathematically optimal result can still be operationally undesirable if the model omits a relevant real-world consideration.

The product should therefore present:

- objective value;
- constraints;
- assumptions;
- data version;
- limitations.

## 8. Data freshness

Reference data should be versioned.

A result should identify the dataset/configuration version used to produce it.

## 9. Explainability limitation

The product should explain observable model behavior from:

- constraints;
- objective contributions;
- infeasible alternatives;
- route metrics.

It should not invent natural-language reasoning that was not produced from actual model information.

## 10. Product positioning

EcoRace Planner should be presented as a **decision-support platform and optimization experiment**, not as an authoritative recommendation for the official F1 calendar.
