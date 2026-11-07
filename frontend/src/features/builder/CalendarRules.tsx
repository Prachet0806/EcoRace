"use client";

import { useState } from "react";
import { SectionLabel } from "@/features/shared/SectionLabel";
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
  summerBreak: SummerBreak | null | undefined;
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

const FIXED_RULES = [
  { name: "One race per weekend", description: "No weekend can host more than a single Grand Prix." },
  { name: "Friday–Sunday race weekends", description: "Standard Formula 1 weekend schedule." },
  { name: "Unique circuit assignment", description: "Each selected venue hosts exactly one Grand Prix per season." },
  { name: "Configured weather feasibility policy", description: "Venues are scheduled within climate and season feasibility windows." },
];

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
  const [fixedRulesOpen, setFixedRulesOpen] = useState(false);

  const breakLabel =
    summerBreak && weekends[summerBreak.start] && weekends[summerBreak.end]
      ? `${fmtWeekend(weekends[summerBreak.start], summerBreak.start)} → ${fmtWeekend(weekends[summerBreak.end], summerBreak.end)}`
      : null;

  return (
    <section aria-label="Calendar rules" className="space-y-4">
      {/* Group 1: Race Schedule */}
      <div className="rounded-xl border border-hairline bg-card p-5">
        <div className="mb-4">
          <SectionLabel>Group 1 · Race schedule</SectionLabel>
          <h3 className="font-display text-base font-medium text-ink mt-1">Race schedule configuration</h3>
          <p className="text-xs text-mute mt-0.5">
            Configure the overall volume of races and maximum consecutive weekend load.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Race count */}
          <div className="rounded-lg border border-hairline/80 bg-base/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-tel text-xs font-semibold uppercase tracking-wider text-mute">Number of races</span>
                <p className="text-xs text-mute mt-0.5">Allowed range: {MIN_RACES}–{MAX_RACES}</p>
              </div>
              <div className="flex items-center gap-1.5" role="group" aria-label="Race count">
                <button
                  type="button"
                  onClick={() => onRaceCount(raceCount - 1)}
                  disabled={sourceLocked || raceCount <= MIN_RACES}
                  aria-label="Fewer races"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline transition-colors hover:bg-lift disabled:opacity-30"
                >
                  −
                </button>
                <output aria-live="polite" className="w-10 text-center font-tel text-lg font-medium tabular-nums text-ink">
                  {raceCount}
                </output>
                <button
                  type="button"
                  onClick={() => onRaceCount(raceCount + 1)}
                  disabled={sourceLocked || raceCount >= MAX_RACES}
                  aria-label="More races"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline transition-colors hover:bg-lift disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            {sourceLocked && (
              <p className="mt-2 font-tel text-[11px] text-mute">
                Locked to official 2026 venue set count ({raceCount} races). Switch to Custom to edit.
              </p>
            )}
          </div>

          {/* Maximum consecutive races */}
          <div className="rounded-lg border border-hairline/80 bg-base/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-tel text-xs font-semibold uppercase tracking-wider text-mute">Max consecutive races</span>
                <p className="text-xs text-mute mt-0.5">Allowed range: {MIN_STREAK}–{MAX_STREAK_LIMIT} weekends</p>
              </div>
              <div className="flex items-center gap-1.5" role="group" aria-label="Maximum consecutive races">
                <button
                  type="button"
                  onClick={() => onMaxConsecutive(maxConsecutive - 1)}
                  disabled={maxConsecutive <= MIN_STREAK}
                  aria-label="Fewer consecutive races"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline transition-colors hover:bg-lift disabled:opacity-30"
                >
                  −
                </button>
                <output aria-live="polite" className="w-10 text-center font-tel text-lg font-medium tabular-nums text-ink">
                  {maxConsecutive}
                </output>
                <button
                  type="button"
                  onClick={() => onMaxConsecutive(maxConsecutive + 1)}
                  disabled={maxConsecutive >= MAX_STREAK_LIMIT}
                  aria-label="More consecutive races"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline transition-colors hover:bg-lift disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-mute">
              Limits how many races can be scheduled in consecutive weekends. A lower value creates more gaps between races to reduce travel fatigue.
            </p>
          </div>
        </div>
      </div>

      {/* Group 2: Calendar Restrictions */}
      <div className="rounded-xl border border-hairline bg-card p-5">
        <div className="mb-4">
          <SectionLabel>Group 2 · Calendar restrictions</SectionLabel>
          <h3 className="font-display text-base font-medium text-ink mt-1">Calendar restrictions</h3>
          <p className="text-xs text-mute mt-0.5">
            Hard constraints enforced by the optimizer during schedule calculation.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Summer break subsection */}
          <div className="rounded-lg border border-hairline/80 bg-base/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-medium text-ink">Summer break</h4>
                <p className="text-xs text-mute">Reserve a mandatory quiet period without any races.</p>
              </div>
              <button
                type="button"
                onClick={() => onSummerBreak(summerBreak ? null : { start: 19, end: 21 })}
                aria-pressed={Boolean(summerBreak)}
                className={`min-h-9 min-w-16 rounded-lg border px-3 font-tel text-xs font-medium transition-colors ${
                  summerBreak
                    ? "border-pass/50 bg-pass/15 text-pass"
                    : "border-hairline text-mute hover:bg-lift hover:text-ink"
                }`}
              >
                {summerBreak ? "On" : "Off"}
              </button>
            </div>

            {summerBreak && (
              <div className="mt-4 space-y-3 pt-3 border-t border-hairline/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-tel text-[11px] text-mute mb-1">Start weekend</label>
                    <select
                      value={summerBreak.start}
                      onChange={(e) =>
                        onSummerBreak({ ...summerBreak, start: Number(e.target.value) })
                      }
                      aria-label="Summer break start weekend"
                      className="w-full rounded-lg border border-hairline bg-card px-2 py-1.5 font-tel text-xs text-ink"
                    >
                      {weekends.map((w, i) => (
                        <option key={w.id} value={i}>
                          {fmtWeekend(w, i)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-tel text-[11px] text-mute mb-1">End weekend</label>
                    <select
                      value={summerBreak.end}
                      onChange={(e) =>
                        onSummerBreak({ ...summerBreak, end: Number(e.target.value) })
                      }
                      aria-label="Summer break end weekend"
                      className="w-full rounded-lg border border-hairline bg-card px-2 py-1.5 font-tel text-xs text-ink"
                    >
                      {weekends.map((w, i) => (
                        <option key={w.id} value={i}>
                          {fmtWeekend(w, i)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {breakLabel && (
                  <p className="font-tel text-xs text-mute" aria-live="polite">
                    Reserved break: <span className="text-ink">{breakLabel}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pin season finale subsection */}
          <div className="rounded-lg border border-hairline/80 bg-base/50 p-4">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <div>
                <h4 className="font-display text-sm font-medium text-ink">Pin season finale</h4>
                <p className="text-xs text-mute mt-0.5">Require the final championship round on the last planning weekend.</p>
              </div>
              <input
                type="checkbox"
                checked={pinEnd}
                onChange={(e) => onPinEnd(e.target.checked)}
                aria-label={`Pin finale to final planning weekend${weekends.length > 0 ? ` (${fmtDay(weekends[weekends.length - 1].friday)})` : ""}`}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border border-hairline accent-rosso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosso"
              />
            </label>
            <p className="mt-3 text-xs leading-relaxed text-mute">
              Enforces scheduling the season finale strictly on the final planning weekend
              {weekends.length > 0 ? ` (${fmtDay(weekends[weekends.length - 1].friday)})` : ""}, mirroring traditional calendar closers.
            </p>
          </div>
        </div>
      </div>

      {/* Group 3: Fixed Scheduling Rules */}
      <div className="rounded-xl border border-hairline bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Group 3 · Fixed scheduling rules</SectionLabel>
            <h3 className="font-display text-base font-medium text-ink mt-1">Invariable model constraints</h3>
            <p className="text-xs text-mute mt-0.5">
              These rules are enforced by EcoRace and cannot be changed here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFixedRulesOpen(!fixedRulesOpen)}
            className="rounded-lg border border-hairline px-3 py-1 font-tel text-xs text-mute hover:bg-lift hover:text-ink"
          >
            {fixedRulesOpen ? "Hide rules" : "View rules"}
          </button>
        </div>

        {fixedRulesOpen && (
          <div className="mt-4 space-y-2 pt-3 border-t border-hairline/60">
            {FIXED_RULES.map((rule) => (
              <div key={rule.name} className="flex items-start gap-2.5 text-xs">
                <span aria-hidden="true" className="mt-0.5 font-tel font-bold text-pass">
                  ✓
                </span>
                <div>
                  <span className="font-medium text-ink">{rule.name}</span>
                  <span className="text-mute ml-2">— {rule.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
