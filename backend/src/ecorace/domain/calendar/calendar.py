"""Calendar aggregate: occupancy, streaks, structural validation (I1/I2/I5/I7/I8)."""
from __future__ import annotations

from dataclasses import dataclass

from ecorace.domain.calendar.weekend import RaceWeekend

MAX_CONSECUTIVE = 3


@dataclass(frozen=True)
class Calendar:
    weekends: tuple[RaceWeekend, ...]
    assignment: dict[str, str]  # weekend_id -> circuit_id (absent = break)

    def race_weekend_ids(self) -> list[str]:
        ids = [w.id for w in self.weekends if w.id in self.assignment]
        return sorted(ids)

    def race_count(self) -> int:
        return len(self.assignment)

    def break_count(self) -> int:
        return len(self.weekends) - len(self.assignment)

    def streaks(self) -> list[int]:
        """Lengths of consecutive occupied-weekend runs in horizon order."""
        streaks: list[int] = []
        run = 0
        for w in self.weekends:
            if w.id in self.assignment:
                run += 1
            elif run:
                streaks.append(run)
                run = 0
        if run:
            streaks.append(run)
        return streaks

    def max_streak(self) -> int:
        return max(self.streaks(), default=0)

    def streak_violations(self) -> list[tuple[str, str, str]]:
        """Return (weekend_id, code, message) for each 4-window with >3 races (I7)."""
        occupied = [w.id in self.assignment for w in self.weekends]
        out: list[tuple[str, str, str]] = []
        for i in range(len(occupied) - 3):
            if sum(occupied[i : i + 4]) > MAX_CONSECUTIVE:
                wid = self.weekends[i + 3].id
                out.append((wid, "STREAK_VIOLATION", f"four consecutive races ending {wid}"))
        return out

    def structural_violations(self) -> list[tuple[str, str, str]]:
        out: list[tuple[str, str, str]] = []
        circuits = list(self.assignment.values())
        if len(set(circuits)) != len(circuits):
            out.append(("", "DUPLICATE_CIRCUIT", "circuit used more than once"))
        out.extend(self.streak_violations())
        return out
