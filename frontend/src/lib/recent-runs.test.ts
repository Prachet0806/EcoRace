import { beforeEach, describe, expect, it } from "vitest";
import { clearRecentRuns, getRun, getStoredRun, isValidRunPayload, recentRunIds, saveRun } from "./recent-runs";
import type { RunPayload } from "./types";

// Mock sessionStorage in node environment
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

const mockPayload: RunPayload = {
  run_id: "run_0123456789abcdef0123456789abcdef",
  status: "optimal",
  season_year: 2026,
  calendar: {
    races: [],
    breaks: [],
    weekend_count: 24,
    race_count: 20,
    break_count: 4,
    max_streak: 3,
  },
  segments: [],
  metrics: {
    total_distance_km: 45000,
    baseline_distance_km: 50000,
    saving_km: 5000,
    baseline_status: "calculated",
  },
  constraints: [],
};

describe("recent-runs and validation", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("validates well-formed RunPayload", () => {
    expect(isValidRunPayload(mockPayload)).toBe(true);
  });

  it("rejects non-object or malformed run payload", () => {
    expect(isValidRunPayload(null)).toBe(false);
    expect(isValidRunPayload("string")).toBe(false);
    expect(isValidRunPayload({ run_id: "invalid_id" })).toBe(false);
    expect(isValidRunPayload({ ...mockPayload, calendar: null })).toBe(false);
    expect(isValidRunPayload({ ...mockPayload, metrics: {} })).toBe(false);
  });

  it("stores and retrieves a valid run", () => {
    saveRun(mockPayload);
    expect(recentRunIds()).toContain(mockPayload.run_id);
    const retrieved = getRun(mockPayload.run_id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.run_id).toBe(mockPayload.run_id);
  });

  it("distinguishes missing vs corrupt JSON vs invalid schema", () => {
    expect(getStoredRun("run_0123456789abcdef0123456789abcdef")).toEqual({ status: "missing" });

    sessionStorage.setItem("ecorace:run:run_0123456789abcdef0123456789abcdef", "{ corrupt-json");
    const corruptJson = getStoredRun("run_0123456789abcdef0123456789abcdef");
    expect(corruptJson.status).toBe("corrupt");

    sessionStorage.setItem("ecorace:run:run_0123456789abcdef0123456789abcdef", JSON.stringify({ run_id: "run_0123456789abcdef0123456789abcdef" }));
    const invalidSchema = getStoredRun("run_0123456789abcdef0123456789abcdef");
    expect(invalidSchema.status).toBe("corrupt");
  });
});
