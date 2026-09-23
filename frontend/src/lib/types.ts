// Full run payload shapes (match backend Phase 2 present_result keys).
// Shared transport types. Mirror backend response shapes; keep in sync
// with OpenAPI (typegen lands when the API stabilizes).

export interface Circuit {
  id: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  region: string;
  timezone: string;
  latitude: number;
  longitude: number;
  // Provenance enrichment: present on current API payloads; optional so
  // older/cached payloads never crash the UI (venueLabel degrades to Grade 1).
  fia_license_grade?: number | null;
  f1_current_2026?: boolean;
  f1_hosted_seasons?: number[];
  venue_source?: string;
}

export interface SeasonWeekend {
  id: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface SeasonSchedule {
  year: number;
  count: number;
  weekends: SeasonWeekend[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

export type OptimizeStatus = "idle" | "optimizing" | "error";

export interface RaceEntry {
  race_id: string;
  weekend_id: string;
  friday: string;
  saturday: string;
  sunday: string;
  circuit_id: string;
  circuit_name: string;
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  segment_id: string;
  from_race_id: string;
  to_race_id: string;
  from_circuit_id: string;
  to_circuit_id: string;
  distance_km: number;
}

export interface ConstraintEntry {
  code: string;
  message: string;
  weekend_id: string;
  circuit_id: string;
}

export interface ConstraintStatus {
  name: string;
  satisfied: boolean;
  violations: ConstraintEntry[];
}

export interface RunPayload {
  run_id: string;
  status: string;
  season_year: number;
  calendar: {
    races: RaceEntry[];
    breaks: string[];
    weekend_count: number;
    race_count: number;
    break_count: number;
    max_streak: number;
  };
  segments: RouteSegment[];
  metrics: {
    total_distance_km: number;
    baseline_distance_km: number | null;
    saving_km: number | null;
    baseline_status: string;
  };
  constraints: ConstraintStatus[];
  solver: {
    name: string;
    version: string;
    runtime_ms: number;
    seed: number;
    status: string;
    optimality_proven: boolean;
    origin: string;
  };
  data_version: string;
}

export type HoverTarget = { kind: "race" | "segment"; id: string } | null;
