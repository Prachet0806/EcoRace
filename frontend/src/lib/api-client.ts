// ADR-FE-002: single typed FastAPI client. Components must not call fetch() directly.
import type { ApiError, Circuit, RunPayload } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_ECORACE_API_URL ?? "http://localhost:8000";

export class EcoRaceApiError extends Error {
  code: string;
  details: unknown[];

  constructor(payload: ApiError) {
    super(payload.error.message);
    this.code = payload.error.code;
    this.details = payload.error.details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as T | ApiError;
  if (!res.ok) {
    if (body && typeof body === "object" && "error" in body) throw new EcoRaceApiError(body as ApiError);
    throw new Error(`EcoRace API ${res.status} on ${path}`);
  }
  return body as T;
}

export const api = {
  baseUrl: BASE_URL,
  health: () => request<{ status: string; dataset_version: string }>("/api/v1/health"),
  circuits: () => request<{ circuits: Circuit[]; count: number; dataset_version: string }>("/api/v1/circuits"),
  createRun: (body: { race_count: number; circuit_ids: string[]; season_year: number }) =>
    request<RunPayload>("/api/v1/optimization/runs", { method: "POST", body: JSON.stringify(body) }),
  getRun: (runId: string) => request<RunPayload>(`/api/v1/optimization/runs/${runId}`),
};
