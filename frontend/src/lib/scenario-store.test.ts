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
});
