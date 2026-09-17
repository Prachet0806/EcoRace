"""Circuit entity + loader (P0-05). IDs are immutable canonical identifiers."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Circuit:
    id: str
    name: str
    city: str
    country: str
    country_code: str
    region: str
    timezone: str
    latitude: float
    longitude: float


def _entries_from(path: str | Path) -> tuple[list[dict], str]:
    """Return (circuit entries, dataset_version). Accepts the FIA wrapper
    object ({"dataset_version": ..., "circuits": [...]}) or a bare array."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        return raw["circuits"], str(raw.get("dataset_version", "unknown"))
    return raw, "legacy-bare-array"


def load_circuit_ids(path: str | Path) -> list[str]:
    entries, _ = _entries_from(path)
    return [e["id"] for e in entries]


def load_circuits(path: str | Path) -> dict[str, Circuit]:
    entries, _ = _entries_from(path)
    circuits: dict[str, Circuit] = {}
    known_keys = set(Circuit.__dataclass_fields__)
    for entry in entries:
        core = {k: v for k, v in entry.items() if k in known_keys}
        c = Circuit(**core)
        if c.id in circuits:
            raise ValueError(f"duplicate circuit id: {c.id}")
        circuits[c.id] = c
    return circuits
