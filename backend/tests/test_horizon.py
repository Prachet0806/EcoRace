"""Phase 0 gate: deterministic weekend generation + 2025/2026 goldens."""
from datetime import timedelta

from ecorace.domain.calendar.weekend import season_weekends


def _assert_wellformed(year: int) -> None:
    weekends = season_weekends(year)
    assert len(weekends) >= 38, f"suspiciously short season: {len(weekends)}"
    seen = set()
    for w in weekends:
        assert w.id == w.friday.isoformat()
        assert w.saturday == w.friday + timedelta(days=1)
        assert w.sunday == w.friday + timedelta(days=2)
        assert w.friday.weekday() == 4  # Friday
        assert w.id not in seen
        seen.add(w.id)
    for a, b in zip(weekends, weekends[1:]):
        assert (b.friday - a.friday).days == 7


def test_season_horizon_2025():
    _assert_wellformed(2025)
    weekends = season_weekends(2025)
    assert weekends[0].friday.isoformat() == "2025-03-07"  # Mar 1 2025 = Saturday
    assert weekends[-1].friday.isoformat() == "2025-12-05"  # first Fri w/ Sun >= Dec 1
    assert len(weekends) == 40


def test_season_horizon_2026():
    _assert_wellformed(2026)
    weekends = season_weekends(2026)
    assert weekends[0].friday.isoformat() == "2026-03-06"  # Mar 1 2026 = Sunday
    assert weekends[-1].friday.isoformat() == "2026-12-04"
    assert len(weekends) == 40
