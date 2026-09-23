"""Independent solution validator. Never trusts the solver.

Checks every hard invariant against domain inputs: count, membership,
uniqueness, occupancy (implicit in Calendar), streak windows, weather,
horizon membership.
"""
from __future__ import annotations

from ecorace.domain.calendar.calendar import Calendar
from ecorace.domain.calendar.scenario import Scenario
from ecorace.domain.calendar.weekend import RaceWeekend, covered_months, summer_break_weekend_ids
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

        for wid, code, message in calendar.streak_violations(scenario.max_consecutive):
            out.append(Violation(code=code, message=message, weekend_id=wid))

        break_ids = summer_break_weekend_ids(scenario, weekends)
        for wid, cid in calendar.assignment.items():
            if wid in break_ids:
                out.append(
                    Violation(
                        code="SUMMER_BREAK_VIOLATION",
                        message=f"{cid} scheduled inside the summer break on {wid}",
                        weekend_id=wid,
                        circuit_id=cid,
                    )
                )

        if scenario.pin_end_to_dec_week1 and weekends and calendar.assignment:
            order = {x.id: i for i, x in enumerate(weekends)}
            last = max(calendar.assignment, key=lambda w: order.get(w, -1))
            if last != weekends[-1].id:
                out.append(
                    Violation(
                        code="DEC_PIN_VIOLATION",
                        message=f"last race is on {last}, pinned to final weekend {weekends[-1].id}",
                        weekend_id=last,
                    )
                )

        occupied_months = {w.friday.month for w in weekends if w.id in calendar.assignment}
        for month, idxs in covered_months(weekends, break_ids).items():
            if month not in occupied_months:
                first = weekends[idxs[0]].id
                out.append(
                    Violation(
                        code="MONTHLY_MINIMUM_VIOLATION",
                        message=f"no race scheduled in month {month:02d}",
                        weekend_id=first,
                    )
                )

        return tuple(out)
