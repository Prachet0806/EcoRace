"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Circuit } from "@/lib/types";

// Feature hook: the only place that loads the circuit library.
// Components consume {circuits, loading, error} — never fetch() directly.
export function useCircuits() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .circuits()
      .then((body) => {
        if (!cancelled) {
          setCircuits(body.circuits);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load circuits.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { circuits, loading, error };
}
