"use client";

import type { HoverTarget, RunPayload } from "@/lib/types";

interface Props {
  run: RunPayload;
  hovered: HoverTarget;
  onHover: (h: HoverTarget) => void;
}

export interface TimelineRow {
  kind: "month" | "race" | "gap";
  key: string;
  month?: string;
  weekNo?: number;
  raceId?: string;
  gapCount?: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Month/week-structured timeline derived from Friday dates.
// weekend_id IS the Friday date, so lexicographic == chronological; the
// W-number is the 1-based position in the full season weekend list.
export function buildTimelineRows(races: RunPayload["calendar"]["races"], breaks: string[]): TimelineRow[] {
  const byWeekend = new Map(races.map((r) => [r.weekend_id, r]));
  const all = [...races.map((r) => r.weekend_id), ...breaks].sort();
  const weekNo = new Map(all.map((wid, i) => [wid, i + 1]));
  const rows: TimelineRow[] = [];
  let gap = 0;
  let lastMonth = "";
  const flushGap = (beforeKey: string) => {
    if (gap > 0) {
      rows.push({ kind: "gap", key: `gap-${beforeKey}`, gapCount: gap });
      gap = 0;
    }
  };
  for (const wid of all) {
    const month = MONTHS[Number(wid.slice(5, 7)) - 1] ?? wid.slice(0, 7);
    if (month !== lastMonth) {
      flushGap(wid);
      rows.push({ kind: "month", key: `month-${wid}`, month });
      lastMonth = month;
    }
    const race = byWeekend.get(wid);
    if (race) {
      flushGap(wid);
      rows.push({ kind: "race", key: race.race_id, raceId: race.race_id, weekNo: weekNo.get(wid) });
    } else {
      gap += 1;
    }
  }
  flushGap("end");
  return rows;
}

export function CalendarTimeline({ run, hovered, onHover }: Props) {
  const rows = buildTimelineRows(run.calendar.races, run.calendar.breaks);
  const races = new Map(run.calendar.races.map((r) => [r.race_id, r]));

  return (
    <section aria-label="Optimized calendar" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Calendar</h2>
      <ol className="max-h-[480px] space-y-1 overflow-y-auto">
        {rows.map((row) => {
          if (row.kind === "month") {
            return (
              <li key={row.key} aria-hidden="true" className="pt-2 font-tel text-xs tracking-widest text-mute uppercase">
                {row.month}
              </li>
            );
          }
          if (row.kind === "gap") {
            return (
              <li
                key={row.key}
                className="border-y border-hairline px-2 py-1 text-center font-tel text-xs tracking-widest text-mute"
                aria-label={`${row.gapCount} break weekends`}
              >
                — BREAK × {row.gapCount} —
              </li>
            );
          }
          const r = races.get(row.raceId!)!;
          const active = hovered?.kind === "race" && hovered.id === r.race_id;
          return (
            <li
              key={r.race_id}
              onMouseEnter={() => onHover({ kind: "race", id: r.race_id })}
              onMouseLeave={() => onHover(null)}
              className={`flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors ${
                active ? "bg-rosso text-white" : "hover:bg-lift"
              }`}
            >
              <span
                className={`w-12 shrink-0 rounded px-1 py-0.5 text-center font-tel text-xs font-semibold ${
                  active ? "bg-white/20 text-white" : "bg-giallo text-black"
                }`}
              >
                {r.race_id.replace("race-", "R")}
              </span>
              <span className="w-14 shrink-0 font-tel text-xs text-mute">W{String(row.weekNo).padStart(2, "0")}</span>
              <span className="font-medium">{r.circuit_name}</span>
              <span className="ml-auto hidden font-tel text-xs text-mute sm:inline">{r.weekend_id}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
