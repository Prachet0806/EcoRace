"""HTTP DTOs. Transport shapes only — never domain entities.

Field names mirror docs/08_API_CONTRACT.md §3-§4.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ScenarioRequest(BaseModel):
    race_count: int = Field(ge=1, le=40)
    circuit_ids: list[str] = Field(min_length=1)
    season_year: int = Field(default=2026, ge=2020, le=2030)
    # MVP fixes the remaining knobs; accepted for forward compatibility, ignored.
    constraints: dict = Field(default_factory=dict)
    objective: dict = Field(default_factory=lambda: {"type": "distance"})


class RunRequest(ScenarioRequest):
    seed: int = 0
    budget_s: float | None = Field(default=None, gt=0, le=300)
