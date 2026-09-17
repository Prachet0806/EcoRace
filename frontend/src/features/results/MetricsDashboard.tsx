"use client";

import type { RunPayload } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Metrics + baseline comparison (10 §4): factual deltas only, no composite score.
export function MetricsDashboard({ run }: { run: RunPayload }) {
  const m = run.metrics;
  const savingPct =
    m.baseline_distance_km && m.saving_km != null
      ? `${((m.saving_km / m.baseline_distance_km) * 100).toFixed(1)}%`
      : "—";
  return (
    <section aria-label="Summary metrics" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Telemetry</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded border border-hairline bg-base p-2">
          <dt className="text-mute">Optimized distance</dt>
          <dd className="font-tel text-lg font-semibold">{fmt(m.total_distance_km)} km</dd>
        </div>
        <div className="rounded border border-hairline bg-base p-2">
          <dt className="text-mute">Baseline distance</dt>
          <dd className="font-tel text-lg font-semibold">
            {m.baseline_distance_km != null ? `${fmt(m.baseline_distance_km)} km` : "infeasible"}
          </dd>
        </div>
        <div className="rounded border border-giallo/40 bg-base p-2">
          <dt className="text-mute">Saved vs baseline</dt>
          <dd className="font-tel text-lg font-semibold text-giallo">
            {m.saving_km != null ? `${fmt(m.saving_km)} km (${savingPct})` : "—"}
          </dd>
        </div>
        <div className="rounded border border-hairline bg-base p-2">
          <dt className="text-mute">Races / Breaks / Max streak</dt>
          <dd className="font-tel text-lg font-semibold">
            {run.calendar.race_count} / {run.calendar.break_count} / {run.calendar.max_streak}
          </dd>
        </div>
      </dl>
      <table className="mt-3 w-full font-tel text-sm">
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
            <td className="py-1 pr-2">Optimality</td>
            <td className="py-1 pr-2">—</td>
            <td className="py-1">
              {run.solver.optimality_proven ? "proven optimal" : "best found (not proven)"} · {run.solver.origin} ·{" "}
              {(run.solver.runtime_ms / 1000).toFixed(1)}s
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 font-tel text-xs text-mute">
        Run {run.run_id} · status {run.status} · dataset {run.data_version}
      </p>
    </section>
  );
}
