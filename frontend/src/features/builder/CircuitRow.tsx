"use client";

import type { Circuit } from "@/lib/types";
import { venueLabel } from "@/features/geography/venueLabel";

interface Props {
  circuit: Circuit;
  seq: number | null; // 1-based selection order; null = not selected
  seasonYear: number;
  disabled?: boolean;
  onToggle: (id: string) => void;
}

// Whole-row single button: one tab stop, fast click loop. Accessible name
// frozen (`Select/Deselect {name}`) — e2e and keyboard behavior depend on it.
export function CircuitRow({ circuit: c, seq, seasonYear, disabled = false, onToggle }: Props) {
  const selected = seq !== null;
  return (
    <button
      type="button"
      onClick={() => onToggle(c.id)}
      disabled={disabled}
      aria-label={`${selected ? "Deselect" : "Select"} ${c.name}`}
      className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed ${
        selected
          ? "border-l-2 border-l-giallo border-y-hairline border-r-hairline bg-lift"
          : "border border-transparent hover:border-hairline hover:bg-lift disabled:hover:border-transparent disabled:hover:bg-transparent"
      }`}
    >
      {selected && (
        <span className="w-7 shrink-0 rounded bg-giallo px-1 py-0.5 text-center font-tel text-xs font-semibold text-black">
          {String(seq).padStart(2, "0")}
        </span>
      )}
      <span className="w-8 shrink-0 rounded bg-lift px-1 py-0.5 text-center font-tel text-xs text-mute">
        {c.country_code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
        <span className="block truncate text-xs text-mute">
          {c.city} · {c.country} · {venueLabel(c, seasonYear)}
        </span>
      </span>
      <span aria-hidden="true" className={`shrink-0 font-tel text-sm ${selected ? "text-rosso-hi" : "text-mute"}`}>
        {selected ? "×" : "+"}
      </span>
    </button>
  );
}
