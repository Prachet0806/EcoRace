"use client";

import type { RunPayload } from "@/lib/types";

function fmt(n: number): string {
  // Great-circle distance is approximate; sub-kilometer precision is noise here.
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// An infeasible baseline remains available as provenance, never as a savings claim.
export function MetricsDashboard({ run }: { run: RunPayload }) {
  const m = run.metrics;
  const baselineStatus = m.baseline_status ?? "ok";
  const baselineComparable = baselineStatus === "ok" && m.baseline_distance_km != null && m.saving_km != null;
  const saving = baselineComparable ? m.saving_km : null;
  const displayedChange = saving == null ? null : Math.round(saving);
  const isRegression = saving != null && saving < -1e-6;
  const isImprovement = saving != null && saving > 1e-6;
  const savingPct =
    saving != null && m.baseline_distance_km
      ? `${Math.abs((saving / m.baseline_distance_km) * 100).toFixed(1)}%`
      : null;
  const changeLabel =
    displayedChange == null ? "—" :
    displayedChange === 0 ? (isRegression ? "+<1 km" : isImprovement ? "−<1 km" : "0 km") :
    isRegression ? `+${fmt(Math.abs(displayedChange))} km` : `−${fmt(displayedChange)} km`;
  const changeCaption =
    displayedChange === 0 ? (isRegression ? "Less than 1 km longer" : isImprovement ? "Less than 1 km shorter" : "Equal distance") :
    savingPct == null ? "" : isRegression ? `${savingPct} longer` : `${savingPct} shorter`;
  const baselineIssue = baselineStatus
    .replace(/^non_comparable:/, "")
    .replace(/_VIOLATION$/, "")
    .replaceAll("_", " ")
    .toLowerCase();

  return (
    <section aria-label="Route impact" className="rounded-xl border border-hairline bg-card p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm text-mute">Total distance</p>
          <p className="mt-2 font-tel text-4xl font-medium tabular-nums tracking-tight sm:text-5xl">
            {fmt(m.total_distance_km)} <span className="text-2xl text-mute">km</span>
          </p>
          <p className="mt-2 text-sm text-mute">
            {run.calendar.race_count} races · {run.calendar.break_count} break weekends
          </p>
        </div>
        <div className="border-t border-hairline pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          {baselineComparable ? (
            <>
              <p className="text-sm text-mute">Change vs feasible baseline</p>
              <p className={`mt-2 font-tel text-3xl font-medium tabular-nums ${isRegression ? "text-rosso-ink" : "text-ink"}`}>
                {changeLabel}
              </p>
              <p className="mt-2 text-sm text-mute">{changeCaption} · baseline {fmt(m.baseline_distance_km!)} km</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-medium">No comparable baseline</p>
              <p className="mt-2 text-sm leading-5 text-mute">
                {m.baseline_distance_km == null
                  ? "No feasible reference route is available for this run."
                  : baselineStatus === "ok"
                    ? `The input-order reference is ${fmt(m.baseline_distance_km)} km, but no valid change was reported.`
                    : `The input-order reference is ${fmt(m.baseline_distance_km)} km, but it violates ${baselineIssue}. It cannot support a savings claim.`}
              </p>
            </>
          )}
        </div>
      </div>
      {isRegression && (
        <p className="mt-5 rounded-lg border border-rosso-ink/40 p-3 text-sm text-rosso-ink">
          Regression guardrail tripped: the optimized route is longer than a comparable baseline. Please report the run ID.
        </p>
      )}
      <details className="mt-5 border-t border-hairline pt-4">
        <summary className="cursor-pointer text-sm text-mute transition-colors hover:text-ink">Baseline and run details</summary>
        <table className="mt-4 w-full text-sm tabular-nums">
          <caption className="sr-only">Run and baseline details</caption>
          <thead>
            <tr className="text-left text-mute">
              <th className="pb-2 font-normal">Metric</th>
              <th className="hidden pb-2 font-normal sm:table-cell">Baseline</th>
              <th className="pb-2 font-normal">Optimized</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-hairline">
              <td className="py-2 pr-4">Travel distance</td>
              <td className="hidden py-2 pr-4 text-mute sm:table-cell">
                {baselineComparable ? `${fmt(m.baseline_distance_km!)} km` : "Not comparable"}
              </td>
              <td className="py-2 font-medium">{fmt(m.total_distance_km)} km</td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="py-2 pr-4">Race weekends</td>
              <td className="hidden py-2 pr-4 text-mute sm:table-cell">{run.calendar.race_count}</td>
              <td className="py-2">{run.calendar.race_count}</td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="py-2 pr-4">Max streak</td>
              <td className="hidden py-2 pr-4 text-mute sm:table-cell">—</td>
              <td className="py-2">{run.calendar.max_streak}</td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="py-2 pr-4">Optimality</td>
              <td className="hidden py-2 pr-4 text-mute sm:table-cell">—</td>
              <td className="py-2">
                {run.solver.optimality_proven ? "Proven optimal" : "Best found (not proven)"} · {run.solver.origin} ·{" "}
                {(run.solver.runtime_ms / 1000).toFixed(1)}s
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}
