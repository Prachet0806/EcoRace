"""OR-Tools CP-SAT solver.

Implements the frozen FORMULATION.md constraints/objective with a sequence
encoding channeled to x[c,w]/r[w] (see docs/FORMULATION.md implementation
addendum): s[k]/t[k] replace the explicit y/circuit encoding because calendar
time-order makes the route a DAG — provably the same feasible set and costs.
Domain code never imported here in reverse: this module depends on the domain,
not vice versa.
"""
from __future__ import annotations

import time

from ortools.sat.python import cp_model

try:
    import ortools

    _ORTOOLS_VERSION = getattr(ortools, "__version__", "unknown")
except Exception:  # pragma: no cover
    _ORTOOLS_VERSION = "unknown"

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.weekend import covered_months, summer_break_weekend_ids
from ecorace.optimization.model import (
    OptimizationProblem,
    SolveStatus,
    SolverConfig,
    SolverMetadata,
    build_distance_matrix,
)


class ORToolsSolver:
    name = "ortools"

    def solve(
        self,
        problem: OptimizationProblem,
        config: SolverConfig,
        hint_calendar: Calendar | None = None,
    ) -> tuple[Calendar | None, SolverMetadata]:
        t0 = time.perf_counter()
        ids = list(problem.scenario.circuit_ids)
        n = len(ids)
        weekends = list(problem.weekends)
        w = len(weekends)
        index_of = {c: i for i, c in enumerate(ids)}
        windex_of = {x.id: k for k, x in enumerate(weekends)}
        matrix = build_distance_matrix(problem.circuits, ids)
        meters = [[int(round(matrix[i][j] * 1000)) for j in range(n)] for i in range(n)]
        break_ids = summer_break_weekend_ids(problem.scenario, problem.weekends)

        model = cp_model.CpModel()
        s = [model.NewIntVar(0, n - 1, f"s[{k}]") for k in range(n)]
        t = [model.NewIntVar(k, w - n + k, f"t[{k}]") for k in range(n)]  # increasing: room both sides
        model.AddAllDifferent(s)
        for k in range(n - 1):
            model.Add(t[k + 1] >= t[k] + 1)
        N = problem.scenario.max_consecutive
        for k in range(n - N):  # t[k+N]==t[k]+N <=> N+1 consecutive occupied weekends
            model.Add(t[k + N] - t[k] >= N + 1)
        if problem.scenario.pin_end_to_dec_week1:
            model.Add(t[n - 1] == w - 1)
        # Monthly minimum: every horizon month untouched by the summer break
        # hosts at least one race. Month index per race via element lookup,
        # then one BoolOr per month over (race, month) membership vars.
        # (An earlier per-(race, weekend) reification exploded presolve Probe
        # to 1.3M+ clauses and stalled first solutions — measured V1.1.)
        month_of = [weekends[wi].friday.month for wi in range(w)]
        m = [model.NewIntVar(1, 12, f"m[{k}]") for k in range(n)]
        for k in range(n):
            model.AddElement(t[k], month_of, m[k])
        month_bool_vars: dict[tuple[int, int], object] = {}
        for month in covered_months(weekends, break_ids):
            lits = []
            for k in range(n):
                c = model.NewBoolVar(f"cov_{month}_{k}")
                model.Add(m[k] == month).OnlyEnforceIf(c)
                model.Add(m[k] != month).OnlyEnforceIf(c.Not())
                lits.append(c)
                month_bool_vars[(k, month)] = c
            model.AddBoolOr(lits)

        # Weather: post the SMALL side of the feasibility partition (identical
        # semantics on a closed pair universe; keeps the model compact).
        feasible_set = {
            (index_of[c], windex_of[x.id])
            for c in ids
            for x in weekends
            if problem.weather.is_feasible(c, x.id) and x.id not in break_ids
        }
        all_pairs = [(ci, wi) for ci in range(n) for wi in range(w)]
        forbidden = [p for p in all_pairs if p not in feasible_set]
        use_forbidden = len(forbidden) <= len(feasible_set)
        rows = forbidden if use_forbidden else sorted(feasible_set)
        for k in range(n):
            if not rows:
                continue
            if use_forbidden:
                model.AddForbiddenAssignments([s[k], t[k]], rows)
            else:
                model.AddAllowedAssignments([s[k], t[k]], rows)

        # Transition cost via element lookup (no reified z-variables):
        flat = [meters[i][j] for i in range(n) for j in range(n)]
        costs = []
        for k in range(n - 1):
            idx = model.NewIntVar(0, n * n - 1, f"idx[{k}]")
            model.Add(idx == s[k] * n + s[k + 1])  # linear: n is const
            c = model.NewIntVar(0, max(flat), f"cost[{k}]")
            model.AddElement(idx, flat, c)
            costs.append(c)
        model.Minimize(sum(costs))

        # Consistent hint from the heuristic calendar's time order: k-th race
        # hints BOTH s[k] (its circuit) and t[k] (its weekend). Mixed-source
        # hints are infeasible and poison the search (measured P1).
        # Completeness matters: monthly membership bools must be hinted too —
        # partial hints stall first solutions (measured V1.1).
        if config.use_hint and hint_calendar is not None:
            cal_order = [hint_calendar.assignment[x.id] for x in weekends if x.id in hint_calendar.assignment]
            if sorted(cal_order) == sorted(ids):
                hint_twi = [windex_of[x.id] for x in weekends if x.id in hint_calendar.assignment]
                hint_months = [weekends[twi].friday.month for twi in hint_twi]
                for k, cid in enumerate(cal_order):
                    model.AddHint(s[k], index_of[cid])
                    model.AddHint(t[k], hint_twi[k])
                for (k, month), b in month_bool_vars.items():
                    model.AddHint(b, month == hint_months[k])

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max(config.time_limit_s, 0.0)
        solver.parameters.random_seed = config.seed
        solver.parameters.num_search_workers = config.num_workers
        # Presolve OFF by default: Probe can expand table/element encodings
        # and stall search within small budgets (measured P1). Presolve ON
        # locks a provided hint almost instantly but improves weakly — the
        # pipeline portfolios both (first seed ON for safety, rest OFF).
        solver.parameters.cp_model_presolve = config.presolve
        status = solver.Solve(model)
        runtime_ms = int((time.perf_counter() - t0) * 1000)

        def meta(st: SolveStatus, obj_km: float | None, proven: bool) -> SolverMetadata:
            return SolverMetadata(
                solver_name=self.name,
                solver_version=_ORTOOLS_VERSION,
                seed=config.seed,
                runtime_ms=runtime_ms,
                time_limit_s=config.time_limit_s,
                status=st,
                objective_km=obj_km,
                optimality_proven=proven,
                data_version=problem.data_version,
            )

        if status == cp_model.OPTIMAL:
            cal = self._extract(solver, s, t, ids, weekends)
            return cal, meta(SolveStatus.FEASIBLE_OPTIMAL, solver.ObjectiveValue() / 1000.0, True)
        if status == cp_model.FEASIBLE:
            cal = self._extract(solver, s, t, ids, weekends)
            return cal, meta(SolveStatus.FEASIBLE_TIMEOUT, solver.ObjectiveValue() / 1000.0, False)
        if status == cp_model.INFEASIBLE:
            return None, meta(SolveStatus.INFEASIBLE, None, False)
        return None, meta(SolveStatus.SOLVER_TIMEOUT, None, False)

    @staticmethod
    def _extract(solver: cp_model.CpSolver, s, t, ids: list[str], weekends) -> Calendar:
        n = len(ids)
        order = [ids[int(solver.Value(s[k]))] for k in range(n)]
        slots = [int(solver.Value(t[k])) for k in range(n)]
        assignment = {weekends[slots[k]].id: order[k] for k in range(n)}
        return Calendar(weekends=tuple(weekends), assignment=assignment)
