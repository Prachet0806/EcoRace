"use client";

import { selectionError } from "@/lib/scenario-store";
import { StatusBadge } from "@/features/shared/StatusBadge";

interface Props {
  selectedCount: number;
  raceCount: number;
}

// Exact-match invariant made visual: count, progress, and actionable gating
// copy (single source of truth: selectionError).
export function SelectionStatus({ selectedCount, raceCount }: Props) {
  const err = selectionError(selectedCount, raceCount);
  const pct = Math.min(100, Math.round((selectedCount / raceCount) * 100));

  let statusLabel: "Not started" | "In progress" | "Ready to optimize" | "Selection exceeds target";
  let tone: "ready" | "warn" | "error" | "info";

  if (selectedCount === 0) {
    statusLabel = "Not started";
    tone = "info";
  } else if (selectedCount < raceCount) {
    statusLabel = "In progress";
    tone = "warn";
  } else if (selectedCount === raceCount) {
    statusLabel = "Ready to optimize";
    tone = "ready";
  } else {
    statusLabel = "Selection exceeds target";
    tone = "error";
  }

  const remaining = raceCount - selectedCount;

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
    <section aria-label="Selection status" className="rounded-xl border border-hairline bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-tel text-xs font-semibold text-mute">Circuit selection</span>
          <p className="font-tel text-sm mt-1">
            <span className="text-3xl font-medium tabular-nums">{selectedCount}</span>
            <span className="text-mute"> / {raceCount}</span>
            <span className="ml-2 font-medium text-mute/80">({pct}% complete)</span>
          </p>
        </div>
        <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded bg-lift"
        role="progressbar"
        aria-valuenow={Math.min(selectedCount, raceCount)}
        aria-valuemin={0}
        aria-valuemax={raceCount}
        aria-valuetext={`${selectedCount} of ${raceCount} circuits selected`}
        aria-label="Circuits selected"
      >
        <div
          className={`h-full transition-[width,background-color] duration-300 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-tel text-xs">
        <p role="status" className={err === null ? "text-pass font-medium" : selectedCount > raceCount ? "text-rosso-ink font-medium" : "text-mute"}>
          {err === null
            ? `Target reached: ${selectedCount} circuits match the configured ${raceCount} races.`
            : err}
        </p>
      </div>
    </section>
  );
}
