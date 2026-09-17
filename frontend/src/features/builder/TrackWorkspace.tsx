"use client";

import { useMemo, useState } from "react";
import { AvailableTracksPane } from "@/features/builder/AvailableTracksPane";
import { SelectedTracksPane } from "@/features/builder/SelectedTracksPane";
import type { Circuit } from "@/lib/types";

// Central workspace: the two-pane interaction is the product centerpiece.
// Both panes derive from canonical circuits + selectedIds (09 §4) — the
// selectedTrackIds invariant is unchanged, only the presentation is new.
interface Props {
  circuits: Circuit[];
  selectedIds: string[];
  seasonYear: number;
  locked: boolean;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function TrackWorkspace({ circuits, selectedIds, seasonYear, locked, onToggle, onClear }: Props) {
  const [tab, setTab] = useState<"selected" | "available">("selected");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = useMemo(
    () => selectedIds.map((id) => circuits.find((c) => c.id === id)).filter((c): c is Circuit => Boolean(c)),
    [circuits, selectedIds],
  );
  const available = useMemo(() => circuits.filter((c) => !selectedSet.has(c.id)), [circuits, selectedSet]);

  return (
    <section aria-label="Track selection">
      {/* Mobile tabs preserve the two-pane semantics on narrow screens:
          same DOM/state, CSS-only visibility. Desktop always shows both. */}
      <div className="mb-2 grid grid-cols-2 gap-2 md:hidden" role="tablist" aria-label="Track panes">
        {(["selected", "available"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded border px-2 py-1 font-tel text-xs tracking-widest uppercase transition-colors ${
              tab === t ? "border-rosso bg-rosso/15 text-ink" : "border-hairline text-mute"
            }`}
          >
            {t === "selected" ? "Your calendar" : "Available"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={tab === "selected" ? "" : "hidden md:block"}>
          <SelectedTracksPane circuits={selected} seasonYear={seasonYear} locked={locked} onToggle={onToggle} onClear={onClear} />
        </div>
        <div className={tab === "available" ? "" : "hidden md:block"}>
          <AvailableTracksPane circuits={available} seasonYear={seasonYear} locked={locked} onToggle={onToggle} />
        </div>
      </div>
    </section>
  );
}
