"use client";

import type { HoverTarget, RunPayload } from "@/lib/types";

interface Props {
  run: RunPayload;
  hovered: HoverTarget;
  onHover: (h: HoverTarget) => void;
}

export function TravelLegs({ run, hovered, onHover }: Props) {
  const byRace = new Map(run.calendar.races.map((r) => [r.race_id, r]));
  return (
    <section aria-label="Travel legs" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">
        Travel legs <span className="font-tel text-giallo">({run.segments.length})</span>
      </h2>
      <ol className="max-h-64 space-y-1 overflow-y-auto">
        {run.segments.map((s) => {
          const active = hovered?.kind === "segment" && hovered.id === s.segment_id;
          const a = byRace.get(s.from_race_id);
          const b = byRace.get(s.to_race_id);
          return (
            <li
              key={s.segment_id}
              onMouseEnter={() => onHover({ kind: "segment", id: s.segment_id })}
              onMouseLeave={() => onHover(null)}
              className={`flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm transition-colors ${
                active ? "bg-rosso text-white" : "hover:bg-lift"
              }`}
            >
              <span className="font-tel text-xs text-mute">{s.segment_id}</span>
              <span className="flex-1">
                {a?.circuit_name} → {b?.circuit_name}
              </span>
              <span className="font-tel">{s.distance_km.toLocaleString("en-US")} km</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
