import type { RunPayload } from "./types";

const RUN_KEY = (runId: string) => `ecorace:run:${runId}`;
const INDEX_KEY = "ecorace:recent-run-ids";
const VALID_ID = /^run_[0-9a-f]{32}$/;
const MAX_RECENT = 10;

export type StorageErrorType = "quota_or_unavailable" | "corrupt" | "invalid_schema" | null;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRace(value: unknown): value is RunPayload["calendar"]["races"][number] {
  if (!isRecord(value)) return false;
  return typeof value.race_id === "string"
    && typeof value.weekend_id === "string"
    && typeof value.friday === "string"
    && typeof value.saturday === "string"
    && typeof value.sunday === "string"
    && typeof value.circuit_id === "string"
    && typeof value.circuit_name === "string"
    && isFiniteNumber(value.latitude)
    && isFiniteNumber(value.longitude);
}

function isSegment(value: unknown): value is RunPayload["segments"][number] {
  if (!isRecord(value)) return false;
  return typeof value.segment_id === "string"
    && typeof value.from_race_id === "string"
    && typeof value.to_race_id === "string"
    && typeof value.from_circuit_id === "string"
    && typeof value.to_circuit_id === "string"
    && isFiniteNumber(value.distance_km);
}

function isConstraint(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.satisfied !== "boolean") return false;
  return Array.isArray(value.violations) && value.violations.every((violation) =>
    isRecord(violation)
      && typeof violation.code === "string"
      && typeof violation.message === "string"
      && typeof violation.weekend_id === "string"
      && typeof violation.circuit_id === "string",
  );
}

function isAttempt(value: unknown): boolean {
  if (!isRecord(value)
    || !isFiniteNumber(value.seed)
    || typeof value.status !== "string"
    || !isNullableNumber(value.km)
    || !isFiniteNumber(value.time_limit_s)
    || !isFiniteNumber(value.runtime_ms)) return false;

  const optionalNumbers = [
    "model_build_ms", "solver_limit_s", "solver_wall_ms", "first_solution_ms",
    "first_solution_km", "solution_count", "presearch_ms", "presolve_estimate_ms",
  ];
  if (optionalNumbers.some((key) => key in value && value[key] !== null && !isFiniteNumber(value[key]))) return false;
  if (["trace_id", "raw_status"].some((key) => key in value && typeof value[key] !== "string")) return false;
  if (["presolve", "hint_supplied", "search_started"].some((key) =>
    key in value && value[key] !== null && typeof value[key] !== "boolean",
  )) return false;
  if ("num_workers" in value && !isFiniteNumber(value.num_workers)) return false;
  return true;
}

function isQualitySelection(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return [
    "shortest_candidate_km", "selected_extra_distance_pct", "longest_hop_km",
    "hops_over_5000_km", "region_changes", "region_backtracks",
  ].every((key) => isFiniteNumber(value[key]));
}

function isProvenance(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.weather_version !== "string"
    || !(value.weather_sha256 === null || typeof value.weather_sha256 === "string")
    || typeof value.circuits_sha256 !== "string"
    || typeof value.weather_synthetic !== "boolean"
    || !isFiniteNumber(value.requested_budget_s)
    || !Array.isArray(value.seed_schedule) || !value.seed_schedule.every(isFiniteNumber)
    || !Array.isArray(value.attempts) || !value.attempts.every(isAttempt)
    || !isFiniteNumber(value.total_runtime_ms)) return false;

  const scenario = value.scenario;
  if (!isRecord(scenario)
    || !isFiniteNumber(scenario.race_count)
    || !isStringArray(scenario.circuit_ids)
    || !isFiniteNumber(scenario.season_year)
    || !isFiniteNumber(scenario.max_consecutive)
    || !(scenario.summer_break_start === null || isFiniteNumber(scenario.summer_break_start))
    || !(scenario.summer_break_end === null || isFiniteNumber(scenario.summer_break_end))
    || typeof scenario.pin_end_to_dec_week1 !== "boolean"
    || !isQualitySelection(value.quality_selection === undefined ? null : value.quality_selection)) return false;

  if (value.timing_ms !== undefined) {
    if (!isRecord(value.timing_ms) || !Object.values(value.timing_ms).every(isFiniteNumber)) return false;
  }
  return true;
}

/** Validate the full shape consumed by results, comparisons, and exports. */
export function isValidRunPayload(val: unknown): val is RunPayload {
  if (!isRecord(val)) return false;
  const calendar = val.calendar;
  const metrics = val.metrics;
  if (!isRecord(calendar) || !isRecord(metrics)) return false;

  if (typeof val.run_id !== "string" || !VALID_ID.test(val.run_id)
    || typeof val.status !== "string"
    || !isFiniteNumber(val.season_year)
    || typeof val.data_version !== "string"
    || !Array.isArray(val.segments) || !val.segments.every(isSegment)
    || !Array.isArray(val.constraints) || !val.constraints.every(isConstraint)
    || !Array.isArray(calendar.races) || !calendar.races.every(isRace)
    || !isStringArray(calendar.breaks)
    || !["weekend_count", "race_count", "break_count", "max_streak"].every((key) => isFiniteNumber(calendar[key]))
    || !isFiniteNumber(metrics.total_distance_km)
    || !isNullableNumber(metrics.baseline_distance_km)
    || !isNullableNumber(metrics.saving_km)
    || typeof metrics.baseline_status !== "string"
    || !isRecord(val.solver)
    || typeof val.solver.name !== "string"
    || typeof val.solver.version !== "string"
    || !isFiniteNumber(val.solver.runtime_ms)
    || !isFiniteNumber(val.solver.seed)
    || typeof val.solver.status !== "string"
    || typeof val.solver.optimality_proven !== "boolean"
    || typeof val.solver.origin !== "string") return false;

  const optionalMetricKeys = ["longest_hop_km", "hops_over_5000_km", "region_changes", "region_backtracks"];
  const races = calendar.races as RunPayload["calendar"]["races"];
  const segments = val.segments as RunPayload["segments"];
  if (optionalMetricKeys.some((key) => key in metrics && !isFiniteNumber(metrics[key]))) return false;
  if ("provenance" in val && val.provenance !== undefined && !isProvenance(val.provenance)) return false;

  const raceById = new Map(races.map((race) => [race.race_id, race]));
  if (raceById.size !== races.length || races.length !== calendar.race_count) return false;
  if (segments.length !== Math.max(0, races.length - 1)) return false;
  if (!segments.every((segment) => {
    const fromRace = raceById.get(segment.from_race_id);
    const toRace = raceById.get(segment.to_race_id);
    return fromRace !== undefined
      && toRace !== undefined
      && fromRace.circuit_id === segment.from_circuit_id
      && toRace.circuit_id === segment.to_circuit_id;
  })) return false;
  return true;
}

export function saveRun(run: RunPayload): void {
  if (!isValidRunPayload(run)) return;
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

  if (parsed.run_id !== runId) {
    return { status: "corrupt", reason: "Payload run_id does not match the requested run_id" };
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
