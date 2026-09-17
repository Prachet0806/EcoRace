import { describe, expect, it } from "vitest";
import { buildTimelineRows } from "@/features/results/CalendarTimeline";
import type { RunPayload } from "@/lib/types";

function race(race_id: string, weekend_id: string): RunPayload["calendar"]["races"][number] {
  return {
    race_id,
    weekend_id,
    friday: weekend_id,
    saturday: weekend_id,
    sunday: weekend_id,
    circuit_id: race_id,
    circuit_name: race_id,
    latitude: 0,
    longitude: 0,
  };
}

describe("buildTimelineRows", () => {
  it("groups months, numbers season weeks, and collapses breaks", () => {
    const races = [race("race-01", "2026-03-06"), race("race-02", "2026-03-13"), race("race-03", "2026-04-03")];
    const rows = buildTimelineRows(races, ["2026-03-20", "2026-03-27"]);
    expect(rows.map((r) => r.kind)).toEqual(["month", "race", "race", "gap", "month", "race"]);
    expect(rows[0]).toMatchObject({ kind: "month", month: "March" });
    expect(rows[3]).toMatchObject({ kind: "gap", gapCount: 2 });
    expect(rows[4]).toMatchObject({ kind: "month", month: "April" });
    expect(rows[5]).toMatchObject({ kind: "race", weekNo: 5 });
  });

  it("handles an all-breaks tail", () => {
    const rows = buildTimelineRows([race("race-01", "2026-03-06")], ["2026-03-13"]);
    expect(rows[rows.length - 1]).toMatchObject({ kind: "gap", gapCount: 1 });
  });
});
