"use client";

import { MAX_RACES, MIN_RACES } from "@/lib/scenario-store";

interface Props {
  raceCount: number;
  seasonYear: number;
  onRaceCount: (n: number) => void;
  onSeasonYear: (y: number) => void;
}

// MVP constraint panel (09 §5): race count + fixed policy display.
// Solver internals (seeds, time limits) stay out of the primary UI.
export function ConstraintPanel({ raceCount, seasonYear, onRaceCount, onSeasonYear }: Props) {
  return (
    <section aria-label="Calendar configuration" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Calendar configuration</h2>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          Races
          <span className="flex items-center gap-1" role="group" aria-label="Race count">
            <button
              type="button"
              onClick={() => onRaceCount(raceCount - 1)}
              disabled={raceCount <= MIN_RACES}
              aria-label="Fewer races"
              className="rounded border border-hairline px-2 transition-colors hover:border-rosso disabled:opacity-40 disabled:hover:border-hairline"
            >
              −
            </button>
            <output aria-live="polite" className="w-8 text-center font-tel font-semibold text-giallo">
              {raceCount}
            </output>
            <button
              type="button"
              onClick={() => onRaceCount(raceCount + 1)}
              disabled={raceCount >= MAX_RACES}
              aria-label="More races"
              className="rounded border border-hairline px-2 transition-colors hover:border-rosso disabled:opacity-40 disabled:hover:border-hairline"
            >
              +
            </button>
          </span>
          <span className="text-mute">
            ({MIN_RACES}–{MAX_RACES})
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Season
          <select
            value={seasonYear}
            onChange={(e) => onSeasonYear(Number(e.target.value))}
            className="rounded border border-hairline bg-base px-2 py-1 text-ink"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </label>
      </div>

      <dl className="mt-3 grid gap-1 text-sm text-mute">
        <div className="flex gap-2 border-t border-hairline pt-2">
          <dt className="text-ink">Horizon:</dt>
          <dd>first Fri–Sun of March → first Fri–Sun covering Dec 1</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink">Weather:</dt>
          <dd>enforced (hard constraint)</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink">Consecutive races:</dt>
          <dd>max 3, then a break weekend</dd>
        </div>
      </dl>
    </section>
  );
}
