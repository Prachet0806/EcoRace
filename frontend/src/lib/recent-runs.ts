const KEY = "ecorace:recent-run-ids";
const VALID_ID = /^run_[0-9a-f]{32}$/;

export function recentRunIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && VALID_ID.test(id)).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function rememberRun(runId: string): void {
  if (!VALID_ID.test(runId)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([runId, ...recentRunIds().filter((id) => id !== runId)].slice(0, 10)));
  } catch {
    // The run link and API retrieval still work when local storage is blocked.
  }
}
