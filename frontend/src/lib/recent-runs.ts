import type { RunPayload } from "./types";

const RUN_KEY = (runId: string) => `ecorace:run:${runId}`;
const INDEX_KEY = "ecorace:recent-run-ids";
const VALID_ID = /^run_[0-9a-f]{32}$/;
const MAX_RECENT = 10;

export type StorageErrorType = "quota_or_unavailable" | "corrupt" | "invalid_schema" | null;

/**
 * Validates whether an unknown parsed object matches the RunPayload shape.
 */
export function isValidRunPayload(val: unknown): val is RunPayload {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  if (typeof obj.run_id !== "string" || !VALID_ID.test(obj.run_id)) return false;
  if (typeof obj.status !== "string") return false;
  if (typeof obj.season_year !== "number") return false;
  if (!obj.calendar || typeof obj.calendar !== "object") return false;
  const cal = obj.calendar as Record<string, unknown>;
  if (!Array.isArray(cal.races) || typeof cal.race_count !== "number") return false;
  if (!Array.isArray(obj.segments)) return false;
  if (!obj.metrics || typeof obj.metrics !== "object") return false;
  const metrics = obj.metrics as Record<string, unknown>;
  if (typeof metrics.total_distance_km !== "number") return false;
  if (!Array.isArray(obj.constraints)) return false;
  return true;
}

export function saveRun(run: RunPayload): void {
  if (!VALID_ID.test(run.run_id)) return;
  try {
    const index = recentRunIds().filter((id) => id !== run.run_id);
    index.unshift(run.run_id);
    sessionStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_RECENT)));
    sessionStorage.setItem(
      RUN_KEY(run.run_id),
      JSON.stringify({ ...run, _savedAt: Date.now() }),
    );
    // Evict payloads that fell off the index.
    const retained = new Set(index.slice(0, MAX_RECENT));
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("ecorace:run:") && !retained.has(key.slice("ecorace:run:".length))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage full/blocked: the optimization result is still valid in React state.
  }
}

export type StoredRunResult =
  | { status: "found"; run: RunPayload }
  | { status: "missing" }
  | { status: "corrupt"; reason: string }
  | { status: "storage_unavailable" };

export function getStoredRun(runId: string): StoredRunResult {
  if (!VALID_ID.test(runId)) return { status: "missing" };
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RUN_KEY(runId));
  } catch {
    return { status: "storage_unavailable" };
  }
  if (!raw) return { status: "missing" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt", reason: "Invalid JSON syntax" };
  }

  if (!isValidRunPayload(parsed)) {
    return { status: "corrupt", reason: "Payload schema mismatch or missing required fields" };
  }

  const { _savedAt, ...run } = parsed as RunPayload & { _savedAt?: number };
  return { status: "found", run: run as RunPayload };
}

export function getRun(runId: string): RunPayload | null {
  const res = getStoredRun(runId);
  return res.status === "found" ? res.run : null;
}

export function recentRuns(): RunPayload[] {
  try {
    const ids = recentRunIds();
    const runs: RunPayload[] = [];
    for (const id of ids) {
      const run = getRun(id);
      if (run) runs.push(run);
    }
    return runs;
  } catch {
    return [];
  }
}

export function recentRunIds(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && VALID_ID.test(id)).slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export function removeRun(runId: string): void {
  if (!VALID_ID.test(runId)) return;
  try {
    sessionStorage.removeItem(RUN_KEY(runId));
    const ids = recentRunIds().filter((id) => id !== runId);
    sessionStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // Best effort.
  }
}

export function clearRecentRuns(): void {
  try {
    for (const id of recentRunIds()) {
      sessionStorage.removeItem(RUN_KEY(id));
    }
    sessionStorage.removeItem(INDEX_KEY);
  } catch {
    // Best effort.
  }
}
