"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { CalendarRules } from "@/features/builder/CalendarRules";
import { firstAugustWeeks, useSeasonWeekends } from "@/features/builder/useSeasonWeekends";
import { CalendarSourceSelector } from "@/features/builder/CalendarSourceSelector";
import { OptimizationCommand } from "@/features/builder/OptimizationCommand";
import { ScenarioHeader } from "@/features/builder/ScenarioHeader";
import { SelectionStatus } from "@/features/builder/SelectionStatus";
import { TrackWorkspace } from "@/features/builder/TrackWorkspace";
import { useCircuits } from "@/features/circuits/useCircuits";
import { RegionDistribution } from "@/features/geography/RegionDistribution";
import { official2026VenueIds } from "@/features/geography/official";
import type { Circuit, RunPayload } from "@/lib/types";

// Client-only: MapLibre needs window/WebGL.
const SelectionMap = dynamic(() => import("@/features/geography/SelectionMap").then((m) => m.SelectionMap), {
  ssr: false,
  loading: () => <p className="font-tel text-sm text-mute">Loading preview…</p>,
});
import { EcoRaceApiError, api } from "@/lib/api-client";
import { rememberRun } from "@/lib/recent-runs";
import { uuidv4 } from "@/lib/uuid";
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
    maxConsecutive,
    summerBreak,
    pinEnd,
    status,
    errorCode,
    errorMessage,
    toggle,
    clear,
    replaceSelection,
    setRaceCount,
    setCalendarSource,
    setMaxConsecutive,
    setSummerBreak,
    setPinEnd,
    setOptimizing,
    setError,
    setDone,
  } = useScenarioStore();
  const { weekends } = useSeasonWeekends(seasonYear);

  // Default summer break: first 3 August weekends, applied once when the
  // season loads and no explicit choice exists. Turning it off afterwards
  // sticks for the session.
  const augustDefaultApplied = useRef(false);
  useEffect(() => {
    if (weekends.length === 0 || summerBreak !== undefined || augustDefaultApplied.current) return;
    augustDefaultApplied.current = true;
    const august = firstAugustWeeks(weekends, 3);
    if (august) setSummerBreak(august);
  }, [weekends, summerBreak, setSummerBreak]);

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
      const body = {
        race_count: count,
        circuit_ids: circuitIds,
        season_year: seasonYear,
        max_consecutive: maxConsecutive,
        summer_break_start: summerBreak?.start ?? null,
        summer_break_end: summerBreak?.end ?? null,
        pin_end_to_dec_week1: pinEnd,
      };
      const serialized = JSON.stringify(body);
      let key = uuidv4();
      try {
        const previous = JSON.parse(localStorage.getItem("ecorace:pending-run") ?? "null") as { body?: string; key?: string } | null;
        if (previous?.body === serialized && previous.key) key = previous.key;
        localStorage.setItem("ecorace:pending-run", JSON.stringify({ body: serialized, key }));
      } catch {
        // Private browsing can disable storage; this submission still works.
      }
      try {
        let result: RunPayload;
        try {
          result = await api.createRun(body, key);
        } catch (e) {
          if (!(e instanceof EcoRaceApiError) || e.code !== "REQUEST_IN_PROGRESS") throw e;
          const submission = await api.getSubmission(key);
          if (submission.status !== "completed" || !submission.run_id) throw e;
          result = await api.getRun(submission.run_id);
        }
        try {
          sessionStorage.setItem(`ecorace:run:${result.run_id}`, JSON.stringify(result));
        } catch {
          // Storage full/blocked: results route falls back to API refetch.
        }
        try { localStorage.removeItem("ecorace:pending-run"); } catch { /* Storage unavailable. */ }
        rememberRun(result.run_id);
        setDone(result.run_id);
        router.push(`/results/${result.run_id}`);
      } catch (e: unknown) {
        if (e instanceof EcoRaceApiError) setError(
          e.code,
          e.code === "SCENARIO_INFEASIBLE"
            ? `${e.message} Try a wider summer-break window, a higher consecutive-race limit, or unpin the finale.`
            : e.message,
        );
        else setError("REQUEST_FAILED", e instanceof Error ? e.message : "Optimization request failed.");
      }
    },
    [seasonYear, maxConsecutive, summerBreak, pinEnd, router, setDone, setError, setOptimizing],
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
      <PageContainer>
        <ScenarioHeader
          kicker="Calendar planner"
          title={
            <>
              Choose circuits for {seasonYear}
            </>
          }
          meta={`${seasonYear} season · ${raceCount} races · 40 weekends · ${sourceLocked ? "official venue set" : "custom"}`}
          badge={
            <span className="rounded-md border border-hairline px-3 py-1 font-tel text-xs text-mute">
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
          <div role="alert" className="rounded-lg border border-rosso-ink/40 p-4 text-sm">
            <p className="font-medium text-rosso-ink">Circuit library unavailable</p>
            <p className="text-mute">
              The planner could not connect to the optimization API: {loadError} Is the API running at {api.baseUrl}?
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 min-h-10 rounded-lg border border-hairline px-4 transition-colors hover:bg-lift"
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <SelectionMap selected={selected} />
          <RegionDistribution selected={selected} />
        </div>

        <CalendarRules
          raceCount={raceCount}
          seasonYear={seasonYear}
          sourceLocked={sourceLocked}
          maxConsecutive={maxConsecutive}
          summerBreak={summerBreak}
          pinEnd={pinEnd}
          weekends={weekends}
          onRaceCount={setRaceCount}
          onMaxConsecutive={setMaxConsecutive}
          onSummerBreak={setSummerBreak}
          onPinEnd={setPinEnd}
        />

        {status === "error" && (
          <p role="alert" className="rounded-lg border border-rosso-ink/40 p-3 font-tel text-sm text-rosso-ink">
            {errorCode}: {errorMessage}
          </p>
        )}

        <OptimizationCommand
          disabled={invalid !== null || loading || loadError !== null}
          disabledReason={invalid}
          running={running}
          summary={`${selectedTrackIds.length} circuits · ${seasonYear} · 40 weekends · max ${maxConsecutive} in a row${
            summerBreak ? ` · break W${summerBreak.start + 1}–W${summerBreak.end + 1}` : ""
          }${pinEnd ? " · Dec finale" : ""}`}
          onOptimize={onOptimize}
        />
      </PageContainer>
    </AppShell>
  );
}
