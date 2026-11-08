"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { CalendarRules } from "@/features/builder/CalendarRules";
import { firstAugustWeeks, useSeasonWeekends } from "@/features/builder/useSeasonWeekends";
import { CalendarSourceSelector } from "@/features/builder/CalendarSourceSelector";
import { OptimizationCommand } from "@/features/builder/OptimizationCommand";
import { OptimizationProgress, type OptimizationPhase } from "@/features/builder/OptimizationProgress";
import { PlannerSectionHeader } from "@/features/builder/PlannerSectionHeader";
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
import { saveRun } from "@/lib/recent-runs";
import { MAX_RACES, MIN_RACES, selectionError, useScenarioStore } from "@/lib/scenario-store";

// Builder workstation v2.1: header → status → workspace → geography →
// rules → command. Two-pane selection invariant unchanged (09 §4).
// Calendar source: custom manual build, or the official 2026 venue-set
// preset (membership only — dates/order are optimizer outputs).
export default function EcoRacePage() {
  const router = useRouter();
  const { circuits } = useCircuits();
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

  const [optimizationPhase, setOptimizationPhase] = useState<OptimizationPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (optimizationPhase === "idle" || optimizationPhase === "complete" || optimizationPhase === "error") {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [optimizationPhase]);

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
      setOptimizationPhase("preparing");

      const body = {
        race_count: count,
        circuit_ids: circuitIds,
        season_year: seasonYear,
        max_consecutive: maxConsecutive,
        summer_break_start: summerBreak?.start ?? null,
        summer_break_end: summerBreak?.end ?? null,
        pin_end_to_dec_week1: pinEnd,
      };

      try {
        setOptimizationPhase("optimizing");
        const result = await api.createRun(body);

        setOptimizationPhase("validating");
        // Verify basic result structure before navigation
        if (!result || typeof result !== "object" || !result.run_id) {
          throw new Error("Returned optimization result was malformed or missing run_id.");
        }

        try {
          saveRun(result);
        } catch {
          // Storage full/blocked: the optimization result is still valid in React state.
        }

        setOptimizationPhase("complete");
        setDone(result.run_id, result);
        router.push(`/results/${result.run_id}`);
      } catch (e: unknown) {
        setOptimizationPhase("error");
        if (e instanceof EcoRaceApiError) {
          setError(
            e.code,
            e.code === "SCENARIO_INFEASIBLE"
              ? `${e.message} Try a wider summer-break window, a higher consecutive-race limit, or unpin the finale.`
              : e.message,
          );
        } else {
          setError("REQUEST_FAILED", e instanceof Error ? e.message : "Optimization request failed.");
        }
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
        // Fail loudly if the bundled catalog does not contain a valid preset.
        if (officialIds.length < MIN_RACES || officialIds.length > MAX_RACES) {
          setError(
            "OFFICIAL_PRESET_UNAVAILABLE",
            `Official 2026 set has ${officialIds.length} venues (expected 20–24). Check the frontend circuit catalog.`,
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
          centered
          kicker={`${seasonYear} SEASON · DRAFT`}
          title="Build your race calendar"
          description="Design your season. Balance the grid. Optimize every weekend."
          meta={
            <div className="flex flex-wrap items-center justify-center gap-3 font-tel text-xs">
              <span className="font-semibold text-rosso-ink">{raceCount} races</span>
              <span className="text-mute">{seasonYear} season</span>
              <span className="text-mute">40 planning weekends</span>
              <span className="text-mute">{sourceLocked ? "Official preset" : "Custom draft"}</span>
            </div>
          }
          badge={
            <span className="rounded border border-hairline bg-lift/60 px-2 py-0.5 font-tel text-[11px] uppercase tracking-wider text-mute">
              Draft
            </span>
          }
        />

        {/* Section 01: Circuit Selection */}
        <PlannerSectionHeader
          step="01 / CIRCUIT SELECTION"
          title="Choose your grid"
          description="Select the circuits that will define your season."
        />

        <SelectionStatus selectedCount={selectedTrackIds.length} raceCount={raceCount} />

        <CalendarSourceSelector
          source={calendarSource}
          officialCount={officialIds.length}
          selectedCount={selectedTrackIds.length}
          onChange={onSourceChange}
        />
        <TrackWorkspace
          circuits={circuits}
          selectedIds={selectedTrackIds}
          seasonYear={seasonYear}
          locked={sourceLocked}
          onToggle={onToggle}
          onClear={onClear}
        />

        {/* Geographic overview section */}
        <section aria-label="Geographic overview" className="space-y-4">
          <div className="text-center pt-4">
            <p className="font-tel text-xs font-semibold text-mute">
              Geographic overview
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">
              Live circuit footprint
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-mute">
              A live geographic overview of the circuits selected above.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <SelectionMap selected={selected} />
            <RegionDistribution selected={selected} />
          </div>
        </section>

        {/* Section 02: Calendar Configuration */}
        <PlannerSectionHeader
          step="02 / CALENDAR CONFIGURATION"
          title="Shape your season"
          description="Set scheduling rules and calendar restrictions."
        />

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

        {/* Section 03: Optimization */}
        {!running && (
          <PlannerSectionHeader
            step="03 / OPTIMIZATION"
            title="Ready for the grid?"
            description="Review your configuration before generating the calendar."
          />
        )}

        {/* Optimization running state vs idle command panel */}
        {running ? (
          <OptimizationProgress phase={optimizationPhase} elapsedSeconds={elapsedSeconds} />
        ) : (
          <>
            {status === "error" && (
              <div role="alert" className="rounded-xl border border-rosso-ink/50 bg-card p-6 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-rosso-ink/15 px-2 py-0.5 font-tel text-xs font-semibold text-rosso-ink">
                    Optimization failed
                  </span>
                  <span className="font-tel text-xs text-mute">{errorCode}</span>
                </div>
                <h3 className="font-display text-xl font-medium text-ink mt-2">
                  We couldn't generate your calendar
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{errorMessage}</p>

                {errorCode === "SCENARIO_INFEASIBLE" && (
                  <div className="mt-4 rounded-lg border border-hairline/70 bg-base/60 p-4">
                    <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-mute mb-2">
                      Suggested next steps:
                    </h4>
                    <ul className="space-y-1.5 text-xs text-mute list-disc list-inside">
                      <li>Increase the maximum consecutive-race limit to allow denser clusters.</li>
                      <li>Widen or adjust the summer-break window.</li>
                      <li>Unpin the season finale to give the scheduler flexibility in December.</li>
                      <li>Review the selected circuit set.</li>
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onOptimize}
                    disabled={invalid !== null}
                    className="rounded-lg bg-rosso px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-rosso-hi disabled:opacity-40"
                  >
                    Try again with current settings
                  </button>
                  <p className="font-tel text-xs text-mute">
                    Your scenario configuration is fully preserved.
                  </p>
                </div>
              </div>
            )}

            <OptimizationCommand
              disabled={invalid !== null}
              disabledReason={invalid}
              running={running}
              selectedCount={selectedTrackIds.length}
              seasonYear={seasonYear}
              maxConsecutive={maxConsecutive}
              summerBreak={summerBreak}
              pinEnd={pinEnd}
              onOptimize={onOptimize}
            />
          </>
        )}
      </PageContainer>
    </AppShell>
  );
}
