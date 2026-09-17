"""Weather feasibility contract (P0-04). Domain sees only is_feasible()."""
from __future__ import annotations

import json
from pathlib import Path


class WeatherPolicy:
    def __init__(self, version: str, feasibility: dict[str, dict[str, bool]], default: bool = True):
        self.version = version
        self._feasibility = feasibility
        self._default = default

    def is_feasible(self, circuit_id: str, weekend_id: str) -> bool:
        return self._feasibility.get(circuit_id, {}).get(weekend_id, self._default)

    @classmethod
    def from_json(cls, path: str | Path) -> "WeatherPolicy":
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        feasibility = raw.get("feasibility", {})
        return cls(version=raw.get("version", "unknown"), feasibility=feasibility, default=raw.get("defaults", True))
