"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { CalendarRules } from "@/features/builder/CalendarRules";
import { CalendarSourceSelector } from "@/features/builder/CalendarSourceSelector";
import { OptimizationCommand } from "@/features/builder/OptimizationCommand";
import { ScenarioHeader } from "@/features/builder/ScenarioHeader";
import { SelectionStatus } from "@/features/builder/SelectionStatus";
import { TrackWorkspace } from "@/features/builder/TrackWorkspace";
import { useCircuits } from "@/features/circuits/useCircuits";
import { RegionDistribution } from "@/features/geography/RegionDistribution";
import { official2026VenueIds } from "@/features/geography/official";
import type { Circuit } from "@/lib/types";

// Client-only: MapLibre needs window/WebGL.
const SelectionMap = dynamic(() => import("@/features/geography/SelectionMap").then((m) => m.SelectionMap), {
  ssr: false,
  loading: () => <p className="font-tel text-sm text-mute">Loading preview…</p>,
});
import { EcoRaceApiError, api } from "@/lib/api-client";
import { MAX_RACES, MIN_RACES, selectionError, useScenarioStore } from "@/lib/scenario-store";

// Builder workstation v2.1: header → status → workspace → geography →
// rules → command. Two-pane selection invariant unchanged (09 §4).
// Calendar source: custom manual build, or the official 2026 venue-set
// preset (membership only — dates/order are optimizer outputs).
export default function EcoRacePage() {
  const router = useRouter();
  const { circuits, loading, error: loadError, retry } = useCircuits();
  const {
    selectedTrackIds,
    raceCount,
    seasonYear,
    calendarSource,
    status,
    errorCode,
    errorMessage,
    toggle,
    clear,
    replaceSelection,
    setRaceCount,
    setCalendarSource,
    setOptimizing,
    setError,
    setDone,
  } = useScenarioStore();

  const invalid = selectionError(selectedTrackIds.length, raceCount);
  const running = status === "optimizing";
  const officialIds = useMemo(() => official2026VenueIds(circuits), [circuits]);
  const sourceLocked = calendarSource === "official-2026-venues";
  const selected = useMemo(
    () => selectedTrackIds.map((id) => circuits.find((c) => c.id === id)).filter((c) => c !== undefined),
    [circuits, selectedTrackIds],
  );

  // Manual edits return an official preset to a custom draft.
  const onToggle = useCallback(
    (id: string) => {
      if (calendarSource === "official-2026-venues") setCalendarSource("custom");
      toggle(id);
    },
    [calendarSource, setCalendarSource, toggle],
  );
  const onClear = useCallback(() => {
    setCalendarSource("custom");
    clear();
  }, [setCalendarSource, clear]);

  const runOptimization = useCallback(
    async (circuitIds: string[], count: number) => {
      setOptimizing();
      try {
        const result = await api.createRun({
          race_count: count,
          circuit_ids: circuitIds,
          season_year: seasonYear,
        });
        try {
          sessionStorage.setItem(`ecorace:run:${result.run_id}`, JSON.stringify(result));
        } catch {
          // Storage full/blocked: results route falls back to API refetch.
        }
        setDone(result.run_id);
        router.push(`/results/${result.run_id}`);
      } catch (e: unknown) {
        if (e instanceof EcoRaceApiError) setError(e.code, e.message);
        else setError("REQUEST_FAILED", e instanceof Error ? e.message : "Optimization request failed.");
      }
    },
    [seasonYear, router, setDone, setError, setOptimizing],
  );

  const onSourceChange = useCallback(
    (source: "custom" | "official-2026-venues") => {
      if (source === "official-2026-venues") {
        if (calendarSource === "official-2026-venues") return;
        // Preset-load only: the 24-race set fills the left pane in order
        // (right pane empties); the user runs the optimization themselves.
        // Guard: a stale API without enrichment fields yields an empty set —
        // fail loudly instead of applying a broken preset.
        if (officialIds.length < MIN_RACES || officialIds.length > MAX_RACES) {
          setError(
            "OFFICIAL_PRESET_UNAVAILABLE",
            `Official 2026 set has ${officialIds.length} venues (expected 20–24). Restart the API to serve current circuit data, then retry.`,
          );
          return;
        }
        replaceSelection(officialIds);
        setRaceCount(officialIds.length);
        setCalendarSource(source);
      } else {
        // Returning to Custom starts a fresh draft: reset the count to 0
        // rather than inheriting the official 24-race selection.
        clear();
        setCalendarSource(source);
      }
    },
    [calendarSource, officialIds, replaceSelection, setRaceCount, setCalendarSource, setError, clear],
  );

  const onOptimize = useCallback(async () => {
    if (invalid || running) return;
    await runOptimization(selectedTrackIds, raceCount);
  }, [invalid, running, runOptimization, selectedTrackIds, raceCount]);

  return (
    <AppShell>
      <PageContainer wide>
        <ScenarioHeader
          kicker="EcoRace · Calendar planner"
          title={
            <>
              Build your <span className="text-rosso">calendar</span>
            </>
          }
          meta={`${seasonYear} season · ${raceCount} races · 40 weekends · ${sourceLocked ? "official venue set" : "custom"}`}
          badge={
            <span className="rounded border border-hairline px-2 py-1 font-tel text-xs tracking-widest text-mute uppercase">
              Draft scenario
            </span>
          }
        />

        <SelectionStatus selectedCount={selectedTrackIds.length} raceCount={raceCount} />

        {loading && (
          <div role="status" aria-label="Loading circuit library">
            <p className="font-tel text-sm text-mute">Loading circuit library…</p>
            <div className="mt-2 grid gap-4 md:grid-cols-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2 rounded-lg border border-hairline bg-card p-3">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-8 rounded bg-lift" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {loadError && !loading && (
          <div role="alert" className="rounded border border-rosso p-3 text-sm">
            <p className="font-semibold">Circuit library unavailable</p>
            <p className="text-mute">
              The planner could not connect to the optimization API: {loadError} Is the API running at {api.baseUrl}?
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 rounded border border-hairline px-3 py-1 transition-colors hover:border-rosso"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !loadError && (
          <>
            <CalendarSourceSelector source={calendarSource} officialCount={officialIds.length} onChange={onSourceChange} />
            <TrackWorkspace
              circuits={circuits}
              selectedIds={selectedTrackIds}
              seasonYear={seasonYear}
              locked={sourceLocked}
              onToggle={onToggle}
              onClear={onClear}
            />
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <SelectionMap selected={selected} />
          <RegionDistribution selected={selected} />
        </div>

        <CalendarRules raceCount={raceCount} seasonYear={seasonYear} sourceLocked={sourceLocked} onRaceCount={setRaceCount} />

        {status === "error" && (
          <p role="alert" className="rounded border border-rosso p-2 font-tel text-sm">
            {errorCode}: {errorMessage}
          </p>
        )}

        <OptimizationCommand
          disabled={invalid !== null || loading || loadError !== null}
          disabledReason={invalid}
          running={running}
          summary={`${selectedTrackIds.length} circuits · ${seasonYear} · 40 weekends`}
          onOptimize={onOptimize}
        />
      </PageContainer>
    </AppShell>
  );
}
