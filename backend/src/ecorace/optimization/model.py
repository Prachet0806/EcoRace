"""P1 model types: problem, config, status, metadata, result.

Pure data + the shared distance matrix. No solver imports here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ecorace.analytics.distance import haversine_km
from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import RaceWeekend
from ecorace.domain.circuit.models import Circuit
from ecorace.domain.constraints.weather import WeatherPolicy


class SolveStatus(str, Enum):
    FEASIBLE_OPTIMAL = "feasible_optimal"
    FEASIBLE = "feasible"
    FEASIBLE_TIMEOUT = "feasible_timeout"  # incumbent returned, optimality NOT_PROVEN
    INFEASIBLE = "infeasible"
    SOLVER_TIMEOUT = "solver_timeout"  # no solution within limit
    SOLVER_FAILURE = "solver_failure"


@dataclass(frozen=True)
class SolverConfig:
    time_limit_s: float = 5.0
    seed: int = 0
    seeds: tuple[int, ...] = (0, 1, 2)
    num_workers: int = 1  # 1 = deterministic; raise only for speed at cost of reproducibility
    use_hint: bool = True


@dataclass(frozen=True)
class OptimizationProblem:
    scenario: Scenario
    weekends: tuple[RaceWeekend, ...]
    circuits: dict[str, Circuit]
    weather: WeatherPolicy
    data_version: str = "unknown"


@dataclass(frozen=True)
class Violation:
    code: str
    message: str
    weekend_id: str = ""
    circuit_id: str = ""


@dataclass(frozen=True)
class SolverMetadata:
    solver_name: str
    solver_version: str
    seed: int
    runtime_ms: int
    time_limit_s: float
    status: SolveStatus
    objective_km: float | None = None
    optimality_proven: bool = False
    data_version: str = "unknown"


@dataclass(frozen=True)
class OptimizationResult:
    status: SolveStatus
    calendar: Calendar | None
    total_distance_km: float | None
    baseline_distance_km: float | None
    violations: tuple[Violation, ...] = ()
    solver: SolverMetadata | None = None
    diagnostics: dict = field(default_factory=dict, compare=False)


def build_distance_matrix(circuits: dict[str, Circuit], order: list[str]) -> list[list[float]]:
    """Symmetric Haversine km matrix aligned with `order` (float, unrounded)."""
    n = len(order)
    mat = [[0.0] * n for _ in range(n)]
    for i, a in enumerate(order):
        ca = circuits[a]
        for j in range(i + 1, n):
            cb = circuits[order[j]]
            d = haversine_km(ca.latitude, ca.longitude, cb.latitude, cb.longitude)
            mat[i][j] = d
            mat[j][i] = d
    return mat


def order_distance_km(order: list[str], circuits: dict[str, Circuit]) -> float:
    pts = [(circuits[c].latitude, circuits[c].longitude) for c in order]
    return sum(
        haversine_km(*pts[i], *pts[i + 1]) for i in range(len(pts) - 1)
    )
