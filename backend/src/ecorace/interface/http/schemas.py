"""HTTP DTOs. Transport shapes only — never domain entities.

Field names mirror docs/08_API_CONTRACT.md §3-§4.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    race_count: int = Field(ge=1, le=40)
    circuit_ids: list[str] = Field(min_length=1)
    season_year: int = Field(default=2026, ge=2020, le=2030)
    max_consecutive: int = Field(default=3, ge=2, le=7)
    summer_break_start: int | None = Field(default=None, ge=0, le=39)
    summer_break_end: int | None = Field(default=None, ge=0, le=39)
    pin_end_to_dec_week1: bool = False


class RunRequest(ScenarioRequest):
    seed: int = Field(default=0, ge=0, le=2_147_483_645)
    budget_s: float | None = Field(default=None, gt=0, le=300)
