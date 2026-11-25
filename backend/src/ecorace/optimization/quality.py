"""Operational travel measures reported alongside, never inside, the objective."""

from __future__ import annotations

from ecorace.analytics.distance import haversine_km
from ecorace.domain.circuit.models import Circuit


def route_quality(order: list[str], circuits: dict[str, Circuit]) -> dict[str, int | float]:
    distances = [
        haversine_km(
            circuits[a].latitude, circuits[a].longitude,
            circuits[b].latitude, circuits[b].longitude,
        )
        for a, b in zip(order, order[1:])
    ]
    regions = [circuits[cid].region for cid in order]
    seen: set[str] = set()
    backtracks = 0
    for i, region in enumerate(regions):
        if i and region != regions[i - 1] and region in seen:
            backtracks += 1
        seen.add(region)
    return {
        "longest_hop_km": round(max(distances, default=0), 2),
        "hops_over_5000_km": sum(distance >= 5000 for distance in distances),
        "region_changes": sum(a != b for a, b in zip(regions, regions[1:])),
        "region_backtracks": backtracks,
    }
