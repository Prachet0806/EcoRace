"use client";

import { useMemo, useState } from "react";
import type { Circuit } from "@/lib/types";

interface Props {
  circuits: Circuit[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

// Two-pane selector (09 §3): LEFT = selected (selection order), RIGHT =
// available (alphabetical from the canonical library, searchable).
// Both lists derive from props + selectedIds; no parallel arrays.
export function TrackSelector({ circuits, selectedIds, onToggle, onClear }: Props) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selected = useMemo(
    () => selectedIds.map((id) => circuits.find((c) => c.id === id)).filter((c): c is Circuit => Boolean(c)),
    [circuits, selectedIds],
  );
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return circuits.filter(
      (c) => !selectedSet.has(c.id) && (q === "" || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)),
    );
  }, [circuits, selectedSet, query]);

  return (
    <section aria-label="Track selection" className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-hairline bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold tracking-widest uppercase">
            Selected{" "}
            <span className="font-tel text-giallo">
              ({selected.length})
            </span>
          </h2>
          {selected.length > 0 && (
            <button type="button" onClick={onClear} className="text-sm text-mute underline hover:text-ink">
              Clear
            </button>
          )}
        </div>
        {selected.length === 0 ? (
          <p className="text-sm text-mute">No tracks selected yet. Pick from the available list.</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-y-auto" aria-label="Selected tracks">
            {selected.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border-l-2 border-l-giallo bg-lift px-2 py-1 transition-colors"
              >
                <span className="text-sm">
                  <span className="mr-2 font-tel text-xs text-giallo">{String(i + 1).padStart(2, "0")}</span>
                  {c.name} <span className="text-mute">· {c.country}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  aria-label={`Deselect ${c.name}`}
                  className="rounded px-2 text-sm text-mute underline hover:text-rosso-hi"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-card p-3">
        <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">
          Available{" "}
          <span className="font-tel text-giallo">
            ({available.length})
          </span>
        </h2>
        <label className="mb-2 block">
          <span className="sr-only">Search available tracks</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks or countries…"
            className="w-full rounded border border-hairline bg-base px-2 py-1 text-sm text-ink placeholder:text-mute"
          />
        </label>
        <ul className="max-h-96 space-y-1 overflow-y-auto" aria-label="Available tracks">
          {available.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 transition-colors hover:bg-lift">
              <span className="text-sm">
                {c.name} <span className="text-mute">· {c.country}</span>
              </span>
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                aria-label={`Select ${c.name}`}
                className="rounded border border-hairline px-2 text-sm text-ink transition-colors hover:border-rosso hover:text-rosso-hi"
              >
                Add
              </button>
            </li>
          ))}
          {available.length === 0 && <li className="text-sm text-mute">No tracks match “{query}”.</li>}
        </ul>
      </div>
    </section>
  );
}
