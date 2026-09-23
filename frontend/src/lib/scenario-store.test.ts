import { describe, expect, it } from "vitest";
import { selectionError, useScenarioStore } from "@/lib/scenario-store";

describe("selectionError (exact-match P0-03)", () => {
  it("requires exact equality", () => {
    expect(selectionError(20, 20)).toBeNull();
    expect(selectionError(18, 20)).toContain("2 more");
    expect(selectionError(22, 20)).toContain("2");
  });
});

describe("scenario store (single source of truth)", () => {
  it("toggles and clears without parallel arrays", () => {
    const { toggle, clear } = useScenarioStore.getState();
    toggle("monza");
    toggle("spa");
    expect(useScenarioStore.getState().selectedTrackIds).toEqual(["monza", "spa"]);
    toggle("monza");
    expect(useScenarioStore.getState().selectedTrackIds).toEqual(["spa"]);
    clear();
    expect(useScenarioStore.getState().selectedTrackIds).toEqual([]);
  });

  it("clamps race count to 20–24", () => {
    const { setRaceCount } = useScenarioStore.getState();
    setRaceCount(99);
    expect(useScenarioStore.getState().raceCount).toBe(24);
    setRaceCount(1);
    expect(useScenarioStore.getState().raceCount).toBe(20);
    setRaceCount(22);
    expect(useScenarioStore.getState().raceCount).toBe(22);
  });

  it("replaces the selection and tracks the calendar source", () => {
    const s = useScenarioStore.getState();
    s.replaceSelection(["a", "b"]);
    expect(useScenarioStore.getState().selectedTrackIds).toEqual(["a", "b"]);
    s.setCalendarSource("official-2026-venues");
    expect(useScenarioStore.getState().calendarSource).toBe("official-2026-venues");
    s.setCalendarSource("custom");
    s.clear();
    expect(useScenarioStore.getState().selectedTrackIds).toEqual([]);
  });

  it("clamps the streak limit to 2–7", () => {
    const { setMaxConsecutive } = useScenarioStore.getState();
    setMaxConsecutive(99);
    expect(useScenarioStore.getState().maxConsecutive).toBe(7);
    setMaxConsecutive(0);
    expect(useScenarioStore.getState().maxConsecutive).toBe(2);
    setMaxConsecutive(2);
    expect(useScenarioStore.getState().maxConsecutive).toBe(2);
    setMaxConsecutive(3);
  });

  it("normalizes inverted summer breaks and toggles the finale pin", () => {
    const s = useScenarioStore.getState();
    s.setSummerBreak({ start: 21, end: 19 });
    expect(useScenarioStore.getState().summerBreak).toEqual({ start: 19, end: 21 });
    s.setSummerBreak(null);
    expect(useScenarioStore.getState().summerBreak).toBeNull();
    s.setPinEnd(true);
    expect(useScenarioStore.getState().pinEnd).toBe(true);
    s.setPinEnd(false);
  });
});
