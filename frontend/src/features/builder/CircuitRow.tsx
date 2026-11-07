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
      className={`group relative flex min-h-12 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rosso disabled:cursor-not-allowed ${
        selected
          ? "border-hairline border-l-[3px] border-l-giallo bg-lift/80 shadow-sm hover:border-l-rosso-ink hover:bg-lift"
          : "border-transparent bg-transparent hover:border-hairline hover:bg-lift/50 disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent"
      }`}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="flex h-6 w-7 shrink-0 items-center justify-center rounded bg-giallo font-tel text-xs font-bold text-black shadow-xs transition-transform duration-150 group-hover:scale-105"
        >
          {String(seq).padStart(2, "0")}
        </span>
      ) : (
        <span className="w-8 shrink-0 rounded bg-lift px-1 py-0.5 text-center font-tel text-xs text-mute group-hover:text-ink">
          {c.country_code}
        </span>
      )}

      {selected && (
        <span className="w-8 shrink-0 rounded bg-base/80 px-1 py-0.5 text-center font-tel text-[11px] text-mute">
          {c.country_code}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium transition-colors ${selected ? "text-ink" : "text-ink/90 group-hover:text-ink"}`}>
          {c.name}
        </span>
        <span className="block truncate text-xs text-mute">
          {c.city} · {c.country} · {venueLabel(c, seasonYear)}
        </span>
      </span>

      {selected ? (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rosso-ink/30 bg-rosso-ink/10 font-tel text-sm font-semibold text-rosso-ink transition-all duration-150 group-hover:border-rosso-ink group-hover:bg-rosso-ink group-hover:text-white"
          title="Remove circuit"
        >
          ×
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline/80 bg-base/60 font-tel text-xs font-semibold text-mute transition-all duration-150 group-hover:border-hairline group-hover:bg-lift group-hover:text-ink"
          title="Add circuit"
        >
          +
        </span>
      )}
    </button>
  );
}
