"""Distance engine (P0-06): Haversine km, float end-to-end, round only at presentation."""
from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def route_distance_km(ordered_circuits: list[tuple[float, float]]) -> float:
    return sum(haversine_km(*ordered_circuits[i], *ordered_circuits[i + 1]) for i in range(len(ordered_circuits) - 1))


def format_km(value: float) -> str:
    return f"{value:,.2f} km"
