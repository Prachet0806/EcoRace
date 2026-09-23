"use client";

import { SectionLabel } from "@/features/shared/SectionLabel";
import { StatusBadge } from "@/features/shared/StatusBadge";
import {
  MAX_RACES,
  MAX_STREAK_LIMIT,
  MIN_RACES,
  MIN_STREAK,
  type SummerBreak,
} from "@/lib/scenario-store";
import type { SeasonWeekend } from "@/lib/types";

interface Props {
  raceCount: number;
  seasonYear: number;
  sourceLocked: boolean;
  maxConsecutive: number;
  summerBreak: SummerBreak | null;
  pinEnd: boolean;
  weekends: SeasonWeekend[];
  onRaceCount: (n: number) => void;
  onMaxConsecutive: (n: number) => void;
  onSummerBreak: (b: SummerBreak | null) => void;
  onPinEnd: (v: boolean) => void;
}

function fmtDay(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

function fmtWeekend(w: SeasonWeekend, i: number): string {
  return `W${i + 1} · ${fmtDay(w.friday)}–${fmtDay(w.sunday)}`;
}

const INVARIANTS = [
  "One race per weekend",
  "Friday–Sunday race weekends",
  "Weather feasibility enforced",
  "Unique circuit assignment",
];

// Policy panel: USER CONFIGURATION (race count, streak limit, summer break,
// finale pin) visually separated from MODEL INVARIANTS (fixed scheduling
// facts). Season is fixed to 2026 internally (API contract) and shown as a
// fact, not a selector.
export function CalendarRules({
  raceCount,
  seasonYear,
  sourceLocked,
  maxConsecutive,
  summerBreak,
  pinEnd,
  weekends,
  onRaceCount,
  onMaxConsecutive,
  onSummerBreak,
  onPinEnd,
}: Props) {
  const breakLabel =
    summerBreak && weekends[summerBreak.start] && weekends[summerBreak.end]
      ? `${fmtWeekend(weekends[summerBreak.start], summerBreak.start)} → ${fmtWeekend(weekends[summerBreak.end], summerBreak.end)}`
      : null;
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
            <label className="flex items-center gap-2 text-sm">
              Max in a row
              <span className="flex items-center gap-1" role="group" aria-label="Maximum consecutive races">
                <button
                  type="button"
                  onClick={() => onMaxConsecutive(maxConsecutive - 1)}
                  disabled={maxConsecutive <= MIN_STREAK}
                  aria-label="Fewer consecutive races"
                  className="rounded border border-hairline px-2 transition-colors hover:border-rosso disabled:opacity-40 disabled:hover:border-hairline"
                >
                  −
                </button>
                <output aria-live="polite" className="w-8 text-center font-tel font-semibold text-giallo">
                  {maxConsecutive}
                </output>
                <button
                  type="button"
                  onClick={() => onMaxConsecutive(maxConsecutive + 1)}
                  disabled={maxConsecutive >= MAX_STREAK_LIMIT}
                  aria-label="More consecutive races"
                  className="rounded border border-hairline px-2 transition-colors hover:border-rosso disabled:opacity-40 disabled:hover:border-hairline"
                >
                  +
                </button>
              </span>
              <span className="text-mute">
                ({MIN_STREAK}–{MAX_STREAK_LIMIT})
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-mute" id="summer-break-label">
                Summer break
              </span>
              <div className="flex items-center gap-1" role="group" aria-labelledby="summer-break-label">
                <button
                  type="button"
                  onClick={() => onSummerBreak(summerBreak ? null : { start: 19, end: 21 })}
                  aria-pressed={summerBreak !== null}
                  className={`rounded border px-2 py-0.5 font-tel text-xs transition-colors ${
                    summerBreak !== null
                      ? "border-rosso bg-rosso/15 text-ink"
                      : "border-hairline text-mute hover:border-rosso hover:text-ink"
                  }`}
                >
                  {summerBreak ? "On" : "Off"}
                </button>
                {summerBreak && (
                  <>
                    <label className="flex items-center gap-1">
                      <span className="sr-only">Summer break start weekend</span>
                      <select
                        value={summerBreak.start}
                        onChange={(e) =>
                          onSummerBreak({ ...summerBreak, start: Number(e.target.value) })
                        }
                        aria-label="Summer break start weekend"
                        className="max-w-40 rounded border border-hairline bg-base px-1 py-0.5 font-tel text-xs text-ink"
                      >
                        {weekends.map((w, i) => (
                          <option key={w.id} value={i}>
                            {fmtWeekend(w, i)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span aria-hidden="true" className="text-mute">
                      –
                    </span>
                    <label className="flex items-center gap-1">
                      <span className="sr-only">Summer break end weekend</span>
                      <select
                        value={summerBreak.end}
                        onChange={(e) =>
                          onSummerBreak({ ...summerBreak, end: Number(e.target.value) })
                        }
                        aria-label="Summer break end weekend"
                        className="max-w-40 rounded border border-hairline bg-base px-1 py-0.5 font-tel text-xs text-ink"
                      >
                        {weekends.map((w, i) => (
                          <option key={w.id} value={i}>
                            {fmtWeekend(w, i)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
              {breakLabel && (
                <p className="mt-1 font-tel text-xs text-giallo" aria-live="polite">
                  {breakLabel}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinEnd}
                onChange={(e) => onPinEnd(e.target.checked)}
                className="h-4 w-4 accent-[#e10600]"
              />
              Pin finale to first December week
            </label>
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
          <p className="mt-2 text-xs text-mute">Streak limit, summer break, and finale pin are enforced as hard constraints.</p>
        </div>
      </div>
    </section>
  );
}
