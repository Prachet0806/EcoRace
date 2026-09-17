"use client";

import { SectionLabel } from "@/features/shared/SectionLabel";
import { StatusBadge } from "@/features/shared/StatusBadge";
import { MAX_RACES, MIN_RACES } from "@/lib/scenario-store";

interface Props {
  raceCount: number;
  seasonYear: number;
  sourceLocked: boolean;
  onRaceCount: (n: number) => void;
}

const INVARIANTS = [
  "One race per weekend",
  "Friday–Sunday race weekends",
  "Weather feasibility enforced",
  "Maximum 3 consecutive race weekends",
  "Mandatory break weekend after 3",
];

// Policy panel: USER CONFIGURATION (race count) visually separated from
// MODEL INVARIANTS (fixed in the MVP optimization model). Season is fixed to
// 2026 internally (API contract) and shown as a fact, not a selector.
export function CalendarRules({ raceCount, seasonYear, sourceLocked, onRaceCount }: Props) {
  return (
    <section aria-label="Calendar rules" className="rounded-lg border border-hairline bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Calendar rules</SectionLabel>
        <StatusBadge tone="info">MVP</StatusBadge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 font-tel text-xs tracking-widest text-mute uppercase">Your configuration</p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Races
              <span className="flex items-center gap-1" role="group" aria-label="Race count">
                <button
                  type="button"
                  onClick={() => onRaceCount(raceCount - 1)}
                  disabled={sourceLocked || raceCount <= MIN_RACES}
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
                  disabled={sourceLocked || raceCount >= MAX_RACES}
                  aria-label="More races"
                  className="rounded border border-hairline px-2 transition-colors hover:border-rosso disabled:opacity-40 disabled:hover:border-hairline"
                >
                  +
                </button>
              </span>
              <span className="text-mute">
                ({MIN_RACES}–{MAX_RACES}){sourceLocked ? " · locked to official set" : ""}
              </span>
            </label>
            <p className="flex items-center gap-2 text-sm">
              <span className="text-mute">Season</span>
              <span className="rounded border border-hairline px-2 py-1 font-tel text-ink">{seasonYear} · fixed</span>
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 font-tel text-xs tracking-widest text-mute uppercase">Fixed model invariants</p>
          <ul className="space-y-1 text-sm">
            {INVARIANTS.map((rule) => (
              <li key={rule} className="flex items-center gap-2">
                <span aria-hidden="true" className="font-tel text-xs text-pass">
                  ✓
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">These rules are fixed in the MVP optimization model.</p>
        </div>
      </div>
    </section>
  );
}
