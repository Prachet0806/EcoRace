"use client";

import { useEffect, useState } from "react";
import { EcoRaceApiError, api } from "@/lib/api-client";
import type { RunPayload } from "@/lib/types";

export type LoadState =
  | { state: "loading" }
  | { state: "ready"; run: RunPayload; source: "session" | "api" }
  | { state: "missing" }
  | { state: "error"; code: string; message: string };

// Results loader: sessionStorage stash first (survives backend restarts),
// API refetch second (supports deep links while the backend is alive).
// MVP has no DB: a missing run after restart is reported, not faked.
export function useRunResult(runId: string): LoadState {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(`ecorace:run:${runId}`);
      if (raw) {
        const run = JSON.parse(raw) as RunPayload;
        if (!cancelled) setLoad({ state: "ready", run, source: "session" });
        return;
      }
    } catch {
      // Corrupt stash: fall through to API.
    }
    api
      .getRun(runId)
      .then((run) => {
        if (!cancelled) setLoad({ state: "ready", run: run as unknown as RunPayload, source: "api" });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof EcoRaceApiError && e.code === "RUN_NOT_FOUND") setLoad({ state: "missing" });
        else setLoad({ state: "error", code: e instanceof EcoRaceApiError ? e.code : "REQUEST_FAILED", message: e instanceof Error ? e.message : "Failed to load result." });
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return load;
}
