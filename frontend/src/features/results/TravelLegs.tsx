"use client";

import type { Circuit, HoverTarget, RunPayload } from "@/lib/types";
import { displayRegion } from "@/features/geography/region";

interface Props {
  run: RunPayload;
  circuits: Circuit[];
  hovered: HoverTarget;
  onHover: (h: HoverTarget) => void;
}

// Travel-leg explorer: sequence, endpoints, distance, region transition.
// Click/hover highlights the map segment and its endpoint races. Regions
// come from the circuit library (already loaded for the builder session);
// absent metadata degrades to distance-only rows.
export function TravelLegs({ run, circuits, hovered, onHover }: Props) {
  const byRace = new Map(run.calendar.races.map((r) => [r.race_id, r]));
  const regionOf = new Map(circuits.map((c) => [c.id, displayRegion(c.region)]));
  const regionName = (circuitId: string | undefined) =>
    (circuitId && regionOf.get(circuitId)) ?? null;

  return (
    <section aria-label="Travel legs" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">
        Travel legs <span className="font-tel text-giallo">({run.segments.length})</span>
      </h2>
      <ol className="max-h-64 space-y-1 overflow-y-auto">
        {run.segments.map((s, i) => {
          const active = hovered?.kind === "segment" && hovered.id === s.segment_id;
          const a = byRace.get(s.from_race_id);
          const b = byRace.get(s.to_race_id);
          const fromRegion = regionName(a?.circuit_id ?? s.from_circuit_id);
          const toRegion = regionName(b?.circuit_id ?? s.to_circuit_id);
          const set = (h: HoverTarget) => onHover(h);
          return (
            <li key={s.segment_id}>
              <button
                type="button"
                onClick={() => set(active ? null : { kind: "segment", id: s.segment_id })}
                onMouseEnter={() => set({ kind: "segment", id: s.segment_id })}
                onMouseLeave={() => set(null)}
                aria-label={`Leg ${i + 1}: ${a?.circuit_name} to ${b?.circuit_name}, ${s.distance_km} kilometers`}
                className={`flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                  active ? "bg-rosso text-white" : "hover:bg-lift"
                }`}
              >
                <span className="w-8 shrink-0 font-tel text-xs text-mute">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  {a?.circuit_name} → {b?.circuit_name}
                  {fromRegion && toRegion && (
                    <span className={`block font-tel text-xs ${active ? "text-white/80" : "text-mute"}`}>
                      {fromRegion} → {toRegion}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-tel">{s.distance_km.toLocaleString("en-US")} km</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
