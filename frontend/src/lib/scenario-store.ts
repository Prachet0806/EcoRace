"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OptimizeStatus } from "./types";

// ADR-FE-003: single source of truth for the scenario draft.
// Available/selected track lists are DERIVED from canonical circuits +
// selectedTrackIds — never stored as parallel arrays (09 §4).
export const MIN_RACES = 20;
export const MAX_RACES = 24;

export type CalendarSource = "custom" | "official-2026-venues";

interface ScenarioState {
  selectedTrackIds: string[];
  raceCount: number;
  seasonYear: number;
  calendarSource: CalendarSource;
  status: OptimizeStatus;
  errorCode: string | null;
  errorMessage: string | null;
  lastRunId: string | null;
  toggle: (id: string) => void;
  clear: () => void;
  replaceSelection: (ids: string[]) => void;
  setRaceCount: (n: number) => void;
  setSeasonYear: (y: number) => void;
  setCalendarSource: (s: CalendarSource) => void;
  setOptimizing: () => void;
  setError: (code: string, message: string) => void;
  setDone: (runId: string) => void;
  resetStatus: () => void;
}

export function selectionError(selectedCount: number, raceCount: number): string | null {
  if (selectedCount < raceCount) return `Select ${raceCount - selectedCount} more track${raceCount - selectedCount === 1 ? "" : "s"} (${selectedCount}/${raceCount}).`;
  if (selectedCount > raceCount) return `Deselect ${selectedCount - raceCount} track${selectedCount - raceCount === 1 ? "" : "s"} (${selectedCount}/${raceCount}).`;
  return null;
}

export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set) => ({
      selectedTrackIds: [],
      raceCount: 20,
      seasonYear: 2026,
      calendarSource: "custom" as CalendarSource,
      status: "idle",
      errorCode: null,
      errorMessage: null,
      lastRunId: null,
      toggle: (id) =>
        set((s) => ({
          selectedTrackIds: s.selectedTrackIds.includes(id)
            ? s.selectedTrackIds.filter((t) => t !== id)
            : [...s.selectedTrackIds, id],
          status: "idle",
          errorCode: null,
          errorMessage: null,
        })),
      clear: () => set({ selectedTrackIds: [], status: "idle", errorCode: null, errorMessage: null }),
      replaceSelection: (ids) =>
        set({ selectedTrackIds: [...ids], status: "idle", errorCode: null, errorMessage: null }),
      setCalendarSource: (calendarSource) =>
        set({ calendarSource, status: "idle", errorCode: null, errorMessage: null }),
      setRaceCount: (n) =>
        set({ raceCount: Math.min(MAX_RACES, Math.max(MIN_RACES, n)), status: "idle", errorCode: null, errorMessage: null }),
      setSeasonYear: (y) => set({ seasonYear: y, status: "idle", errorCode: null, errorMessage: null }),
      setOptimizing: () => set({ status: "optimizing", errorCode: null, errorMessage: null }),
      setError: (code, message) => set({ status: "error", errorCode: code, errorMessage: message }),
      setDone: (runId) => set({ status: "idle", lastRunId: runId }),
      resetStatus: () => set({ status: "idle", errorCode: null, errorMessage: null }),
    }),
    { name: "ecorace-scenario", partialize: (s) => ({ selectedTrackIds: s.selectedTrackIds, raceCount: s.raceCount, seasonYear: s.seasonYear, calendarSource: s.calendarSource }) as ScenarioState },
  ),
);
