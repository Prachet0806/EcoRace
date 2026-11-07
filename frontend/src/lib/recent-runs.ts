import type { RunPayload } from "./types";

const RUN_KEY = (runId: string) => `ecorace:run:${runId}`;
const INDEX_KEY = "ecorace:recent-run-ids";
const VALID_ID = /^run_[0-9a-f]{32}$/;
const MAX_RECENT = 10;

type CachedRun = { runId: string; savedAt: number };

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

export function getRun(runId: string): RunPayload | null {
  if (!VALID_ID.test(runId)) return null;
  try {
    const raw = sessionStorage.getItem(RUN_KEY(runId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunPayload & { _savedAt?: number };
    if (!parsed || typeof parsed !== "object" || !parsed.run_id) return null;
    const { _savedAt, ...run } = parsed;
    return run as RunPayload;
  } catch {
    return null;
  }
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
