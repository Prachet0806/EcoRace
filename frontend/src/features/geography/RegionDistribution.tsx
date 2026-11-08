"use client";

import { useMemo } from "react";
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
  const lead = rows.findIndex((r) => r.count === max);

  return (
    <section aria-label="Geographic mix" className="rounded-xl border border-hairline bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <span className="font-tel text-xs font-semibold text-mute">Regional distribution</span>
          <h3 className="font-display text-base font-medium text-ink mt-0.5">Distribution by continent</h3>
        </div>
        <span className="rounded-md border border-hairline bg-lift px-2.5 py-1 font-tel text-xs text-mute">
          Based on selected circuits
        </span>
      </div>

      {selected.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-hairline/60 bg-base/50 p-6 text-center">
          <p className="font-tel text-sm text-mute">Select circuits to see your geographic distribution.</p>
          <p className="mt-1 text-xs text-mute/80">Regional representation updates dynamically as you choose venues.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5 border-t border-hairline/60 pt-3">
            {rows.map((r, i) => (
              <li key={r.region} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 font-tel text-mute">{r.region}</span>
                <span
                  className={`h-2 rounded-sm ${i === lead ? "bg-rosso" : "bg-mute/40"}`}
                  role="img"
                  aria-label={`${r.region}: ${r.count}`}
                  style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, maxWidth: "100%" }}
                />
                <span className="font-tel text-ink font-medium">{r.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-mute">
        Geographic distribution is descriptive, not a measure of route quality. The optimizer determines hop efficiency.
      </p>
    </section>
  );
}
