"use client";

import type { HoverTarget, RunPayload } from "@/lib/types";

interface Props {
  run: RunPayload;
  hovered: HoverTarget;
  onHover: (h: HoverTarget) => void;
}

// Timing-tower timeline: position badges, mono dates, break bands.
// Chronological: weekend_id IS the Friday date, so lexicographic == chronological.
export function CalendarTimeline({ run, hovered, onHover }: Props) {
  const byWeekend = new Map(run.calendar.races.map((r) => [r.weekend_id, r]));

  const rows: Array<{ kind: "race"; id: string } | { kind: "gap"; key: string; count: number }> = [];
  let gap = 0;
  const all = [...run.calendar.races.map((r) => r.weekend_id), ...run.calendar.breaks].sort();
  for (const wid of all) {
    const race = byWeekend.get(wid);
    if (race) {
      if (gap > 0) {
        rows.push({ kind: "gap", key: `gap-${wid}`, count: gap });
        gap = 0;
      }
      rows.push({ kind: "race", id: race.race_id });
    } else {
      gap += 1;
    }
  }
  if (gap > 0) rows.push({ kind: "gap", key: "gap-end", count: gap });

  const races = new Map(run.calendar.races.map((r) => [r.race_id, r]));

  return (
    <section aria-label="Optimized calendar" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Timing tower</h2>
      <ol className="max-h-[480px] space-y-1 overflow-y-auto">
        {rows.map((row) =>
          row.kind === "gap" ? (
            <li
              key={row.key}
              className="border-y border-hairline px-2 py-1 text-center font-tel text-xs tracking-widest text-mute"
              aria-label={`${row.count} break weekends`}
            >
              — BREAK × {row.count} —
            </li>
          ) : (
            (() => {
              const r = races.get(row.id)!;
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
                  <span className="w-24 shrink-0 font-tel text-xs text-mute">{r.weekend_id}</span>
                  <span className="font-medium">{r.circuit_name}</span>
                </li>
              );
            })()
          ),
        )}
      </ol>
    </section>
  );
}
