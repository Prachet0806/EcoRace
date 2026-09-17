"use client";

import type { RunPayload } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Impact summary: hero metrics with factual baseline deltas only.
// No composite score — the comparison table states what changed, not why.
export function MetricsDashboard({ run }: { run: RunPayload }) {
  const m = run.metrics;
  const savingPct =
    m.baseline_distance_km && m.saving_km != null
      ? `${((m.saving_km / m.baseline_distance_km) * 100).toFixed(1)}%`
      : null;
  return (
    <section aria-label="Route impact" className="rounded-lg border border-hairline bg-card p-4">
      <div className="grid gap-4 text-center md:grid-cols-3">
        <div>
          <p className="font-tel text-xs tracking-widest text-mute uppercase">Total distance</p>
          <p className="font-tel text-3xl font-semibold md:text-4xl">{fmt(m.total_distance_km)} km</p>
          <p className="mt-1 font-tel text-xs text-mute">
            {run.calendar.race_count} races · {run.calendar.break_count} breaks
          </p>
        </div>
        <div>
          <p className="font-tel text-xs tracking-widest text-mute uppercase">Baseline</p>
          <p className="font-tel text-3xl font-semibold text-mute md:text-4xl">
            {m.baseline_distance_km != null ? `${fmt(m.baseline_distance_km)} km` : "infeasible"}
          </p>
          <p className="mt-1 font-tel text-xs text-mute">input order, earliest feasible weekends</p>
        </div>
        <div>
          <p className="font-tel text-xs tracking-widest text-mute uppercase">Change</p>
          <p className="font-tel text-3xl font-semibold text-giallo md:text-4xl">
            {m.saving_km != null ? `−${fmt(m.saving_km)} km` : "—"}
          </p>
          <p className="mt-1 font-tel text-xs text-mute">{savingPct != null ? `${savingPct} shorter` : "no baseline"}</p>
        </div>
      </div>
      <table className="mt-4 w-full font-tel text-sm">
        <caption className="sr-only">Baseline comparison</caption>
        <thead>
          <tr className="text-left text-mute">
            <th className="pr-2 font-normal">Metric</th>
            <th className="pr-2 font-normal">Baseline</th>
            <th className="font-normal">Optimized</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-hairline">
            <td className="py-1 pr-2">Travel distance</td>
            <td className="py-1 pr-2">{m.baseline_distance_km != null ? `${fmt(m.baseline_distance_km)} km` : "—"}</td>
            <td className="py-1 text-rosso">{fmt(m.total_distance_km)} km</td>
          </tr>
          <tr className="border-t border-hairline">
            <td className="py-1 pr-2">Race weekends</td>
            <td className="py-1 pr-2">{run.calendar.race_count}</td>
            <td className="py-1">{run.calendar.race_count}</td>
          </tr>
          <tr className="border-t border-hairline">
            <td className="py-1 pr-2">Max streak</td>
            <td className="py-1 pr-2">—</td>
            <td className="py-1">{run.calendar.max_streak}</td>
          </tr>
          <tr className="border-t border-hairline">
            <td className="py-1 pr-2">Optimality</td>
            <td className="py-1 pr-2">—</td>
            <td className="py-1">
              {run.solver.optimality_proven ? "proven optimal" : "best found (not proven)"} · {run.solver.origin} ·{" "}
              {(run.solver.runtime_ms / 1000).toFixed(1)}s
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
