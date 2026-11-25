# Solver quality gate

EcoRace still minimizes great-circle route distance in CP-SAT. The heuristic
now tries nearest-neighbor/2-opt tours, one-pass region-block repairs, and
region-clustered tours. All placed calendars pass the independent validator
before selection. Among calendars within 2% of the shortest validated
candidate, selection prefers fewer region re-entries, then fewer legs of at
least 5,000 km, then a shorter longest leg, then total distance. A comparable
baseline remains an upper bound on selected distance. The result records the
selected distance tradeoff and travel measures for user inspection.

Reproduce the dataset comparison on Python 3.11:

```sh
python backend/tests/bench_quality.py --budget 3
python backend/tests/bench_quality.py --budget 9
python backend/tests/bench_quality.py --probe-seeds 50
```

The benchmark uses catalog-first 20/24, official-2026 20/24, and two seeded
mixed-region sets. It reports wall time, validator violations, distance,
longest hop, long-hop count, region changes, and region re-entries separately
for the heuristic and a single CP-SAT attempt. The 50-seed probe covers
additional deterministic 24-venue combinations.

On the local 50-seed probe, the original nearest-neighbor/2-opt heuristic had
14 calendars with region re-entries. Region clustering alone reduced this to
13; adding local region-block repair reduced it to 6. All 50 remained
validator-clean. Seed 1 went from 43,471.64 km with two re-entries to
44,134.97 km with none, a 1.53% distance tradeoff. A nine-second single
CP-SAT attempt matched the heuristic on one catalog case and timed out without
a candidate on three other cases; the production pipeline keeps a validated
heuristic fallback. These measurements are local and do not prove quality for
every venue set or machine.

Before increasing the route-quality tolerance or changing the CP-SAT
objective, rerun the benchmark on production-sized hardware and inspect both
distance and travel pattern. Run the backend regression suite after solver
changes; its deterministic cases check constraints, baseline comparison,
regional re-entry, long hops, and deadline behavior.
