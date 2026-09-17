"use client";

import { useMemo } from "react";
import { SectionLabel } from "@/features/shared/SectionLabel";
import { countByRegion } from "@/features/geography/region";
import type { Circuit } from "@/lib/types";

interface Props {
  selected: Circuit[];
}

// Descriptive regional mix of the current selection. Not a score, not an
// objective — regional structure made visible (problem-domain context).
export function RegionDistribution({ selected }: Props) {
  const rows = useMemo(() => countByRegion(selected), [selected]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (selected.length === 0) {
    return (
      <section aria-label="Geographic mix" className="rounded-lg border border-hairline bg-card p-3">
        <SectionLabel>Geographic mix</SectionLabel>
        <p className="mt-1 text-sm text-mute">Select circuits to see the regional footprint.</p>
      </section>
    );
  }
  return (
    <section aria-label="Geographic mix" className="rounded-lg border border-hairline bg-card p-3">
      <SectionLabel>Geographic mix</SectionLabel>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.region} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 font-tel text-xs text-mute">{r.region}</span>
            <span
              className="h-2 rounded-sm bg-rosso"
              role="img"
              aria-label={`${r.region}: ${r.count}`}
              style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, maxWidth: "100%" }}
            />
            <span className="font-tel text-xs text-ink">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
