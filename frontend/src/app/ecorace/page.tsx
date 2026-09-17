"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Pinstripe } from "@/components/ui/Pinstripe";
import { ConstraintPanel } from "@/features/constraints/ConstraintPanel";
import { TrackSelector } from "@/features/circuits/TrackSelector";
import { useCircuits } from "@/features/circuits/useCircuits";
import { OptimizeButton } from "@/features/optimization/OptimizeButton";
import { EcoRaceApiError, api } from "@/lib/api-client";
import { selectionError, useScenarioStore } from "@/lib/scenario-store";

// Builder: Select → Configure → Optimize (09 §10). Results live at
// /ecorace/results/[runId]; the run payload is stashed in sessionStorage so
// the results route survives backend restarts (MVP has no DB).
export default function EcoRacePage() {
  const router = useRouter();
  const { circuits, loading, error: loadError } = useCircuits();
  const {
    selectedTrackIds,
    raceCount,
    seasonYear,
    status,
    errorCode,
    errorMessage,
    toggle,
    clear,
    setRaceCount,
    setSeasonYear,
    setOptimizing,
    setError,
    setDone,
  } = useScenarioStore();

  const invalid = selectionError(selectedTrackIds.length, raceCount);
  const running = status === "optimizing";

  const onOptimize = useCallback(async () => {
    if (invalid || running) return;
    setOptimizing();
    try {
      const result = await api.createRun({
        race_count: raceCount,
        circuit_ids: selectedTrackIds,
        season_year: seasonYear,
      });
      try {
        sessionStorage.setItem(`ecorace:run:${result.run_id}`, JSON.stringify(result));
      } catch {
        // Storage full/blocked: results route falls back to API refetch.
      }
      setDone(result.run_id);
      router.push(`/ecorace/results/${result.run_id}`);
    } catch (e: unknown) {
      if (e instanceof EcoRaceApiError) setError(e.code, e.message);
      else setError("REQUEST_FAILED", e instanceof Error ? e.message : "Optimization request failed.");
    }
  }, [invalid, running, raceCount, selectedTrackIds, seasonYear, router, setDone, setError, setOptimizing]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 bg-base p-4 text-ink">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight italic">
          EcoRace <span className="text-rosso">Planner</span>
        </h1>
        <p className="text-sm text-mute">Select tracks, configure the calendar, optimize, then inspect the result.</p>
        <Pinstripe className="mt-3" />
      </header>

      {loading && (
        <p role="status" className="font-tel text-sm text-mute">
          Loading circuit library…
        </p>
      )}
      {loadError && (
        <p role="alert" className="rounded border border-rosso p-2 text-sm">
          Could not load circuits: {loadError} Is the API running at {api.baseUrl}?
        </p>
      )}
      {!loading && !loadError && (
        <TrackSelector circuits={circuits} selectedIds={selectedTrackIds} onToggle={toggle} onClear={clear} />
      )}

      <ConstraintPanel raceCount={raceCount} seasonYear={seasonYear} onRaceCount={setRaceCount} onSeasonYear={setSeasonYear} />

      {status === "error" && (
        <p role="alert" className="rounded border border-rosso p-2 font-tel text-sm">
          {errorCode}: {errorMessage}
        </p>
      )}

      <OptimizeButton disabled={invalid !== null || loading || loadError !== null} disabledReason={invalid} running={running} onOptimize={onOptimize} />

      <footer className="text-xs text-mute">
        <Pinstripe className="mb-2 opacity-60" />
        Decision-support experiment, not an official F1 calendar. Distances are great-circle approximations; weather
        reflects the configured feasibility policy, not a forecast.
      </footer>
    </main>
  );
}
