import type { SeasonWeekend } from "@/lib/types";

function firstFridayOnOrAfter(day: Date): Date {
  const friday = new Date(day);
  const delta = (5 - friday.getUTCDay() + 7) % 7;
  friday.setUTCDate(friday.getUTCDate() + delta);
  return friday;
}

// Mirrors backend/domain/calendar/weekend.py. Dates are deterministic and do
// not depend on the API, so planner controls remain available offline.
export function seasonWeekends(year: number): SeasonWeekend[] {
  if (!Number.isInteger(year) || year < 2020 || year > 2030) return [];

  const start = firstFridayOnOrAfter(new Date(Date.UTC(year, 2, 1)));
  const decemberAnchor = new Date(Date.UTC(year, 11, 1));
  decemberAnchor.setUTCDate(decemberAnchor.getUTCDate() - 2);
  const end = firstFridayOnOrAfter(decemberAnchor);
  const weekends: SeasonWeekend[] = [];

  for (const friday = new Date(start); friday <= end; friday.setUTCDate(friday.getUTCDate() + 7)) {
    const saturday = new Date(friday);
    const sunday = new Date(friday);
    saturday.setUTCDate(saturday.getUTCDate() + 1);
    sunday.setUTCDate(sunday.getUTCDate() + 2);
    const id = friday.toISOString().slice(0, 10);
    weekends.push({
      id,
      friday: id,
      saturday: saturday.toISOString().slice(0, 10),
      sunday: sunday.toISOString().slice(0, 10),
    });
  }
  return weekends;
}

// Weekend ids are Friday dates; indices are 0-based season positions.
export function useSeasonWeekends(year: number) {
  return { weekends: seasonWeekends(year) };
}

// First n weekends whose Friday falls in August (0-based indices).
export function firstAugustWeeks(weekends: SeasonWeekend[], n = 3): { start: number; end: number } | null {
  const idx = weekends
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.friday.slice(5, 7) === "08")
    .slice(0, n)
    .map(({ i }) => i);
  if (idx.length < n) return null;
  return { start: idx[0], end: idx[idx.length - 1] };
}
