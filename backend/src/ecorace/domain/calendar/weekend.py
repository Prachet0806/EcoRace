"""EcoRace domain: calendar contracts (P0-01/P0-02).

Weekend = {Friday, Saturday, Sunday}, id = Friday ISO date.
Season Y: first Friday >= Mar 1 .. first Friday with Sunday >= Dec 1, step 7d.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class RaceWeekend:
    id: str  # Friday ISO date, e.g. "2026-03-06"
    friday: date
    saturday: date
    sunday: date

    def __post_init__(self) -> None:
        if self.saturday != self.friday + timedelta(days=1):
            raise ValueError("Saturday must be Friday + 1 day")
        if self.sunday != self.friday + timedelta(days=2):
            raise ValueError("Sunday must be Friday + 2 days")
        if self.id != self.friday.isoformat():
            raise ValueError("Weekend id must equal Friday ISO date")


def _first_friday_on_or_after(day: date) -> date:
    # Monday=0..Sunday=6; Friday=4
    delta = (4 - day.weekday()) % 7
    return day + timedelta(days=delta)


def first_friday_sunday_weekend(year: int, month: int) -> RaceWeekend:
    """First Fri-Sun block whose Friday is on/after the 1st of (year, month)."""
    friday = _first_friday_on_or_after(date(year, month, 1))
    return RaceWeekend(
        id=friday.isoformat(),
        friday=friday,
        saturday=friday + timedelta(days=1),
        sunday=friday + timedelta(days=2),
    )


def season_weekends(year: int) -> tuple[RaceWeekend, ...]:
    """Every Fri-Sun block from Mar W1 through Dec W1 inclusive.

    start = first Friday >= Mar 1.
    end   = first Friday with Sunday >= Dec 1 (i.e. Friday >= Dec1 - 2d).
    """
    start = first_friday_sunday_weekend(year, 3).friday
    # First Friday whose Sunday >= Dec 1
    anchor = date(year, 12, 1) - timedelta(days=2)
    end = _first_friday_on_or_after(anchor)
    weekends: list[RaceWeekend] = []
    friday = start
    while friday <= end:
        weekends.append(
            RaceWeekend(
                id=friday.isoformat(),
                friday=friday,
                saturday=friday + timedelta(days=1),
                sunday=friday + timedelta(days=2),
            )
        )
        friday += timedelta(days=7)
    return tuple(weekends)
