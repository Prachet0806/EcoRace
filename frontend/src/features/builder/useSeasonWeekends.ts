"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { SeasonWeekend } from "@/lib/types";

// Season weekend list for date-aware controls (summer break picker).
// Weekend ids are Friday dates; indices are 0-based season positions.
export function useSeasonWeekends(year: number) {
  const [weekends, setWeekends] = useState<SeasonWeekend[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .seasonWeekends(year)
      .then((body) => {
        if (!cancelled) setWeekends(body.weekends);
      })
      .catch(() => {
        if (!cancelled) setWeekends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return { weekends };
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
