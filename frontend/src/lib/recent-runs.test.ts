import { beforeEach, describe, expect, it } from "vitest";
import { clearRecentRuns, getRun, getStoredRun, isValidRunPayload, recentRunIds, saveRun } from "./recent-runs";
import { useScenarioStore } from "./scenario-store";
import type { RunPayload } from "./types";

// Mock sessionStorage in node environment with configurable failure hooks
const store: Record<string, string> = {};
let throwOnGet = false;
let throwOnSet = false;

const mockSessionStorage = {
  getItem: (key: string) => {
    if (throwOnGet) {
      throw new Error("SecurityError: Storage is disabled or blocked");
    }
    return store[key] ?? null;
  },
  setItem: (key: string, value: string) => {
    if (throwOnSet) {
      throw new Error("QuotaExceededError: DOM Exception 22");
    }
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
  solver: {
    name: "highs",
    version: "1.5.0",
    runtime_ms: 120,
    seed: 42,
    status: "optimal",
    optimality_proven: true,
    origin: "ortools",
  },
  data_version: "2026.1",
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
    throwOnGet = false;
    throwOnSet = false;
    sessionStorage.clear();
    useScenarioStore.setState({ immediateResult: null });
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

  it("verifies parsed.run_id === runId to prevent returning mismatched stored runs", () => {
    const wrongPayload = {
      ...mockPayload,
      run_id: "run_fedcba9876543210fedcba9876543210",
    };
    // Store wrongPayload under mockPayload's key
    sessionStorage.setItem("ecorace:run:run_0123456789abcdef0123456789abcdef", JSON.stringify(wrongPayload));

    const result = getStoredRun("run_0123456789abcdef0123456789abcdef");
    expect(result.status).toBe("corrupt");
    if (result.status === "corrupt") {
      expect(result.reason).toContain("does not match");
    }
    expect(getRun("run_0123456789abcdef0123456789abcdef")).toBeNull();
  });

  it("handles storage disabled / throwing in getItem", () => {
    throwOnGet = true;
    const res = getStoredRun(mockPayload.run_id);
    expect(res.status).toBe("storage_unavailable");
    expect(getRun(mockPayload.run_id)).toBeNull();
  });

  it("handles quota exceeded during saveRun without throwing", () => {
    throwOnSet = true;
    expect(() => saveRun(mockPayload)).not.toThrow();
  });

  it("keeps result accessible through Zustand store after saveRun failure", () => {
    throwOnSet = true;
    // Simulate saveRun failure during optimization completion
    saveRun(mockPayload);
    useScenarioStore.getState().setDone(mockPayload.run_id, mockPayload);

    // In-memory immediate result survives storage failure
    const inMemory = useScenarioStore.getState().immediateResult;
    expect(inMemory).not.toBeNull();
    expect(inMemory?.run_id).toBe(mockPayload.run_id);
  });

  it("treats result as unavailable after a hard refresh when storage is blocked", () => {
    throwOnSet = true;
    saveRun(mockPayload);
    useScenarioStore.getState().setDone(mockPayload.run_id, mockPayload);

    // Simulate page reload / fresh tab with blocked storage
    // On hard refresh, in-memory Zustand immediateResult is reset to null
    useScenarioStore.setState({ immediateResult: null });
    throwOnGet = true; // storage remains blocked/disabled

    const stored = getStoredRun(mockPayload.run_id);
    expect(stored.status).toBe("storage_unavailable");
    expect(useScenarioStore.getState().immediateResult).toBeNull();
  });
});
