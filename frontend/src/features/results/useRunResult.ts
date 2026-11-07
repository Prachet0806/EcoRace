"use client";

import { useEffect, useState } from "react";
import type { RunPayload } from "@/lib/types";
import { getRun } from "@/lib/recent-runs";

export type LoadState =
  | { state: "loading" }
  | { state: "ready"; run: RunPayload; source: "session" }
  | { state: "missing" }
  | { state: "invalid" };

// Results loader: sessionStorage only. The backend does not retain run history,
// so a missing or corrupt stash means the result is unavailable in this session.
export function useRunResult(runId: string): LoadState {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    try {
      const run = getRun(runId);
      if (run) {
        if (!cancelled) setLoad({ state: "ready", run, source: "session" });
        return;
      }
      if (!cancelled) setLoad({ state: "missing" });
    } catch {
      if (!cancelled) setLoad({ state: "invalid" });
    }
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return load;
}
