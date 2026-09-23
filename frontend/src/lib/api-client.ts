// ADR-FE-002: single typed FastAPI client. Components must not call fetch() directly.
import type { ApiError, Circuit, RunPayload, SeasonSchedule } from "./types";
import { useToastStore } from "./useToastStore";

const BASE_URL = process.env.NEXT_PUBLIC_ECORACE_API_URL ?? "http://localhost:8000";

export class EcoRaceApiError extends Error {
  code: string;
  details: unknown[];
  status: number;

  constructor(payload: ApiError, status: number) {
    super(payload.error.message);
    this.code = payload.error.code;
    this.details = payload.error.details;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, retry = 0): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as T | ApiError;
  if (!res.ok) {
    if (res.status === 429 && retry < 3) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000 * (retry + 1)));
      return request(path, init, retry + 1);
    }
    if (body && typeof body === "object" && "error" in body) throw new EcoRaceApiError(body as ApiError, res.status);
    throw new Error(`EcoRace API ${res.status} on ${path}`);
  }
  return body as T;
}

function notifyError(error: EcoRaceApiError) {
  if (error.status >= 500 || error.code === "SOLVER_OVERLOADED") {
    useToastStore.getState().add(error.message, "error", 8000);
  }
}

export const api = {
  baseUrl: BASE_URL,
  health: () => request<{ status: string; dataset_version: string }>("/api/v1/health"),
  circuits: () => request<{ circuits: Circuit[]; count: number; dataset_version: string }>("/api/v1/circuits"),
  seasonWeekends: (year: number) => request<SeasonSchedule>(`/api/v1/seasons/${year}/weekends`),
  createRun: (body: {
    race_count: number;
    circuit_ids: string[];
    season_year: number;
    max_consecutive?: number;
    summer_break_start?: number | null;
    summer_break_end?: number | null;
    pin_end_to_dec_week1?: boolean;
  }) =>
    request<RunPayload>("/api/v1/optimization/runs", { method: "POST", body: JSON.stringify(body) }).catch((e) => {
      if (e instanceof EcoRaceApiError) notifyError(e);
      throw e;
    }),
  getRun: (runId: string) => request<RunPayload>(`/api/v1/optimization/runs/${runId}`).catch((e) => {
    if (e instanceof EcoRaceApiError) notifyError(e);
    throw e;
  }),
};
