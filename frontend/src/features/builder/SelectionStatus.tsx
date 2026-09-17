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
  return (
    <section aria-label="Selection status" className="rounded-lg border border-hairline bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-tel text-sm">
          <span className="text-2xl font-semibold text-giallo">{selectedCount}</span>
          <span className="text-mute"> / {raceCount} CIRCUITS</span>
        </p>
        <StatusBadge tone={tone}>{err === null ? "READY" : selectedCount > raceCount ? "OVER" : "BUILDING"}</StatusBadge>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded bg-lift"
        role="progressbar"
        aria-valuenow={selectedCount}
        aria-valuemin={0}
        aria-valuemax={raceCount}
        aria-label="Circuits selected"
      >
        <div
          className={`h-full transition-[width] ${err === null ? "bg-pass" : selectedCount > raceCount ? "bg-rosso" : "bg-giallo"}`}
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
