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

        model = cp_model.CpModel()
        s = [model.NewIntVar(0, n - 1, f"s[{k}]") for k in range(n)]
        t = [model.NewIntVar(k, w - n + k, f"t[{k}]") for k in range(n)]  # increasing: room both sides
        model.AddAllDifferent(s)
        for k in range(n - 1):
            model.Add(t[k + 1] >= t[k] + 1)
        for k in range(n - 3):  # t[k+3]==t[k]+3 <=> 4 consecutive occupied weekends
            model.Add(t[k + 3] - t[k] >= 4)

        # Weather: post the SMALL side of the feasibility partition (identical
        # semantics on a closed pair universe; keeps the model compact).
        feasible_set = {
            (index_of[c], windex_of[x.id])
            for c in ids
            for x in weekends
            if problem.weather.is_feasible(c, x.id)
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
        if config.use_hint and hint_calendar is not None:
            cal_order = [hint_calendar.assignment[x.id] for x in weekends if x.id in hint_calendar.assignment]
            if sorted(cal_order) == sorted(ids):
                for k, cid in enumerate(cal_order):
                    model.AddHint(s[k], index_of[cid])
                for x in weekends:
                    if x.id in hint_calendar.assignment:
                        k = cal_order.index(hint_calendar.assignment[x.id])
                        model.AddHint(t[k], windex_of[x.id])

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max(config.time_limit_s, 0.0)
        solver.parameters.random_seed = config.seed
        solver.parameters.num_search_workers = config.num_workers
        # Presolve's Probe expands the table/element encoding into 1M+ clauses
        # and never reaches search within MVP budgets (measured P1). The model
        # is tight by construction (hint + domain bounds), so solve directly.
        solver.parameters.cp_model_presolve = False
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
