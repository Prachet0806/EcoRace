"use client";

import { useEffect, useState } from "react";
import type { RunPayload } from "@/lib/types";
import { getStoredRun } from "@/lib/recent-runs";
import { useScenarioStore } from "@/lib/scenario-store";

export type LoadState =
  | { state: "loading" }
  | { state: "ready"; run: RunPayload; source: "session" | "memory" }
  | { state: "missing" }
  | { state: "invalid"; reason?: string }
  | { state: "storage_unavailable" };

// Results loader: checks in-memory immediate result from zustand store first,
// then falls back to sessionStorage. This ensures results survive storage failure / quota exhaustion.
export function useRunResult(runId: string): LoadState {
  const immediateResult = useScenarioStore((s) => s.immediateResult);
  const [load, setLoad] = useState<LoadState>(() => {
    if (immediateResult && immediateResult.run_id === runId) {
      return { state: "ready", run: immediateResult, source: "memory" };
    }
    return { state: "loading" };
  });

  useEffect(() => {
    // 1. In-memory check
    if (immediateResult && immediateResult.run_id === runId) {
      setLoad({ state: "ready", run: immediateResult, source: "memory" });
      return;
    }

    // 2. Session-storage check with explicit error discrimination
    let cancelled = false;
    const stored = getStoredRun(runId);

    if (cancelled) return;

    if (stored.status === "found") {
      setLoad({ state: "ready", run: stored.run, source: "session" });
    } else if (stored.status === "corrupt") {
      setLoad({ state: "invalid", reason: stored.reason });
    } else if (stored.status === "storage_unavailable") {
      setLoad({ state: "storage_unavailable" });
    } else {
      setLoad({ state: "missing" });
    }

    return () => {
      cancelled = true;
    };
  }, [runId, immediateResult]);

  return load;
}
