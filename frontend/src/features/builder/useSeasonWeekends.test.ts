import { describe, expect, it } from "vitest";
import { firstAugustWeeks } from "@/features/builder/useSeasonWeekends";
import type { SeasonWeekend } from "@/lib/types";

function wk(id: string): SeasonWeekend {
  return { id, friday: id, saturday: id, sunday: id };
}

describe("firstAugustWeeks", () => {
  it("returns the first 3 August weekends", () => {
    const weekends = ["2026-07-31", "2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"].map(wk);
    expect(firstAugustWeeks(weekends, 3)).toEqual({ start: 1, end: 3 });
  });

  it("returns null when August is short", () => {
    expect(firstAugustWeeks([wk("2026-08-07")], 3)).toBeNull();
    expect(firstAugustWeeks([], 3)).toBeNull();
  });
});
