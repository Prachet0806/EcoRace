"""Independent solution validator. Never trusts the solver.

Checks every hard invariant against domain inputs: count, membership,
uniqueness, occupancy (implicit in Calendar), streak windows, weather,
horizon membership.
"""
from __future__ import annotations

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import RaceWeekend
from ecorace.domain.constraints.weather import WeatherPolicy
from ecorace.optimization.model import Violation


class SolutionValidator:
    @staticmethod
    def validate(
        calendar: Calendar,
        scenario: Scenario,
        weekends: tuple[RaceWeekend, ...],
        weather: WeatherPolicy,
    ) -> tuple[Violation, ...]:
        out: list[Violation] = []
        horizon_ids = {w.id for w in weekends}

        if calendar.race_count() != scenario.race_count:
            out.append(
                Violation(
                    code="RACE_COUNT_MISMATCH",
                    message=f"calendar has {calendar.race_count()} races, scenario wants {scenario.race_count}",
                )
            )

        seen: set[str] = set()
        for wid, cid in calendar.assignment.items():
            if wid not in horizon_ids:
                out.append(Violation(code="UNKNOWN_WEEKEND", message=f"{wid} outside horizon", weekend_id=wid))
            if cid in seen:
                out.append(
                    Violation(
                        code="DUPLICATE_CIRCUIT",
                        message=f"{cid} used more than once",
                        weekend_id=wid,
                        circuit_id=cid,
                    )
                )
            seen.add(cid)
            if cid not in scenario.circuit_ids:
                out.append(
                    Violation(
                        code="UNSELECTED_CIRCUIT",
                        message=f"{cid} not in scenario selection",
                        weekend_id=wid,
                        circuit_id=cid,
                    )
                )
            if not weather.is_feasible(cid, wid):
                out.append(
                    Violation(
                        code="WEATHER_INFEASIBLE",
                        message=f"{cid} not weather-feasible on {wid}",
                        weekend_id=wid,
                        circuit_id=cid,
                    )
                )

        for wid, code, message in calendar.streak_violations():
            out.append(Violation(code=code, message=message, weekend_id=wid))

        return tuple(out)
