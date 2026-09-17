"use client";

import { useMemo, useState } from "react";
import { CircuitRow } from "@/features/builder/CircuitRow";
import { SectionLabel } from "@/features/shared/SectionLabel";
import { distinctRegions, displayRegion } from "@/features/geography/region";
import type { Circuit } from "@/lib/types";

interface Props {
  circuits: Circuit[]; // available only, alphabetical
  seasonYear: number;
  locked: boolean;
  onToggle: (id: string) => void;
}

export function AvailableTracksPane({ circuits, seasonYear, locked, onToggle }: Props) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("All");
  const regions = useMemo(() => distinctRegions(circuits), [circuits]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return circuits.filter(
      (c) =>
        (region === "All" || displayRegion(c.region) === region) &&
        (q === "" || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)),
    );
  }, [circuits, region, query]);

  return (
    <div className="rounded-lg border border-hairline bg-card p-3">
      <SectionLabel>Available circuits</SectionLabel>
      <p className="mb-2 font-tel text-xs text-mute">Available ({visible.length})</p>
      <label className="mb-2 block">
        <span className="sr-only">Search available tracks</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search circuits…"
          className="w-full rounded border border-hairline bg-base px-2 py-1 text-sm text-ink placeholder:text-mute"
        />
      </label>
      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Filter by region">
        {["All", ...regions].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            aria-pressed={region === r}
            className={`rounded border px-2 py-0.5 font-tel text-xs transition-colors ${
              region === r
                ? "border-rosso bg-rosso/15 text-ink"
                : "border-hairline text-mute hover:border-rosso hover:text-ink"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <ul className="max-h-96 space-y-1 overflow-y-auto" aria-label="Available tracks">
          {visible.map((c) => (
            <li key={c.id}>
              <CircuitRow circuit={c} seq={null} seasonYear={seasonYear} disabled={locked} onToggle={onToggle} />
            </li>
          ))}
        {visible.length === 0 && (
          <li className="text-sm text-mute">No tracks match{query.trim() === "" ? " this filter" : ` “${query}”`}.</li>
        )}
      </ul>
    </div>
  );
}
