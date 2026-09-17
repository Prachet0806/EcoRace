"""Reference-data loader (infrastructure adapter).

Reads versioned JSON from the data/ directory. Returns domain objects —
never ORM rows (there is no database in MVP). UTF-8 always: venue names
contain non-ASCII characters.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from ecorace.domain.calendar.weekend import RaceWeekend, season_weekends
from ecorace.domain.circuit.models import load_circuits
from ecorace.domain.constraints.weather import WeatherPolicy


def data_dir() -> Path:
    override = os.environ.get("ECORACE_DATA_DIR")
    if override:
        return Path(override)
    # backend/src/ecorace/infrastructure/ -> repo root = parents[4]
    return Path(__file__).resolve().parents[4] / "data"


@lru_cache(maxsize=1)
def dataset_version() -> str:
    return (data_dir() / "DATASET_VERSION").read_text(encoding="utf-8").strip()


@lru_cache(maxsize=1)
def circuits_bundle() -> tuple[dict, str]:
    """Return (circuits dict, circuits dataset version tag)."""
    circuits = load_circuits(data_dir() / "circuits.json")
    raw = json.loads((data_dir() / "circuits.json").read_text(encoding="utf-8"))
    tag = raw.get("dataset_version", "unknown") if isinstance(raw, dict) else "legacy"
    return circuits, tag


@lru_cache(maxsize=1)
def weather_policy() -> WeatherPolicy:
    return WeatherPolicy.from_json(data_dir() / "weather" / "weather-v1.json")


def season(year: int) -> tuple[RaceWeekend, ...]:
    if not 2020 <= year <= 2030:
        raise ValueError(f"unsupported season year: {year}")
    return season_weekends(year)


def circuit_list_sorted() -> list[dict]:
    circuits, _ = circuits_bundle()
    return sorted(
        (
            {
                "id": c.id,
                "name": c.name,
                "city": c.city,
                "country": c.country,
                "country_code": c.country_code,
                "region": c.region,
                "timezone": c.timezone,
                "latitude": c.latitude,
                "longitude": c.longitude,
            }
            for c in circuits.values()
        ),
        key=lambda e: e["name"].lower(),
    )
