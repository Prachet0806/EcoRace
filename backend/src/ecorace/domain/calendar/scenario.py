"""Scenario validation (P0-03): exact-match MVP, duplicates, unknown IDs, race count."""
from __future__ import annotations

from dataclasses import dataclass


class InsufficientCircuits(Exception):
    code = "INSUFFICIENT_CIRCUITS"


class ExcessCircuits(Exception):
    code = "EXCESS_CIRCUITS"


class DuplicateCircuit(Exception):
    code = "DUPLICATE_CIRCUIT"


class UnknownCircuit(Exception):
    code = "UNKNOWN_CIRCUIT_ID"


class InvalidRaceCount(Exception):
    code = "INVALID_RACE_COUNT"


class InvalidStreakLimit(Exception):
    code = "INVALID_STREAK_LIMIT"


class InvalidSummerBreak(Exception):
    code = "INVALID_SUMMER_BREAK"


@dataclass(frozen=True)
class Scenario:
    race_count: int
    circuit_ids: tuple[str, ...]
    season_year: int
    max_consecutive: int = 3
    summer_break_start: int | None = None
    summer_break_end: int | None = None
    pin_end_to_dec_week1: bool = False


def validate_scenario(scenario: Scenario, known_circuit_ids: set[str]) -> Scenario:
    if not 20 <= scenario.race_count <= 24:
        raise InvalidRaceCount(f"race_count must be 20-24, got {scenario.race_count}")
    if not 2 <= scenario.max_consecutive <= 7:
        raise InvalidStreakLimit(f"max_consecutive must be 2-7, got {scenario.max_consecutive}")
    brk = (scenario.summer_break_start, scenario.summer_break_end)
    if (brk[0] is None) != (brk[1] is None):
        raise InvalidSummerBreak("summer break needs both start and end, or neither")
    if brk[0] is not None and brk[1] is not None and brk[0] > brk[1]:
        raise InvalidSummerBreak(f"summer break start ({brk[0]}) must not exceed end ({brk[1]})")
    if len(set(scenario.circuit_ids)) != len(scenario.circuit_ids):
        raise DuplicateCircuit("duplicate circuit ids in scenario")
    unknown = [c for c in scenario.circuit_ids if c not in known_circuit_ids]
    if unknown:
        raise UnknownCircuit(f"unknown circuit ids: {unknown}")
    if len(scenario.circuit_ids) < scenario.race_count:
        raise InsufficientCircuits(f"{len(scenario.circuit_ids)} circuits for {scenario.race_count} races")
    if len(scenario.circuit_ids) > scenario.race_count:
        raise ExcessCircuits(f"{len(scenario.circuit_ids)} circuits for {scenario.race_count} races")
    return scenario
