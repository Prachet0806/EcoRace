"use client";

import { selectionError } from "@/lib/scenario-store";
import { StatusBadge } from "@/features/shared/StatusBadge";

interface Props {
  selectedCount: number;
  raceCount: number;
}

// Exact-match invariant made visual: count, progress, and the same gating
// copy the optimize command enforces (single source: selectionError).
export function SelectionStatus({ selectedCount, raceCount }: Props) {
  const err = selectionError(selectedCount, raceCount);
  const pct = Math.min(100, Math.round((selectedCount / raceCount) * 100));
  const tone = err === null ? "ready" : selectedCount > raceCount ? "error" : "warn";

  // Move from red (low) to yellow (intermediate) to green (required number reached).
  // If selection exceeds the required number, keep alert tone (red).
  const barColor =
    selectedCount === raceCount
      ? "bg-pass"
      : selectedCount > raceCount
        ? "bg-rosso"
        : pct >= 50
          ? "bg-giallo"
          : "bg-rosso";

  return (
    <section aria-label="Selection status" className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-tel text-sm">
          <span className="text-2xl font-medium tabular-nums">{selectedCount}</span>
          <span className="text-mute"> / {raceCount} circuits selected</span>
        </p>
        <StatusBadge tone={tone}>{err === null ? "Ready" : selectedCount > raceCount ? "Over target" : "Building"}</StatusBadge>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded bg-lift"
        role="progressbar"
        aria-valuenow={Math.min(selectedCount, raceCount)}
        aria-valuemin={0}
        aria-valuemax={raceCount}
        aria-valuetext={`${selectedCount} of ${raceCount} circuits selected`}
        aria-label="Circuits selected"
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {err !== null && (
        <p role="status" className="mt-1 font-tel text-sm text-mute">
          {err}
        </p>
      )}
    </section>
  );
}
