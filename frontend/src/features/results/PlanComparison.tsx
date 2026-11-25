"use client";

import { useEffect, useState } from "react";
import { getRun, recentRunIds, saveRun } from "@/lib/recent-runs";
import type { RunPayload } from "@/lib/types";
import { summarizeActiveConstraints } from "@/features/results/constraintSummary";

function metric(value: number | undefined): string {
  return value === undefined ? "Not recorded" : Math.round(value).toLocaleString("en-US");
}

function scenarioDifferences(current: RunPayload, previous: RunPayload): string[] {
  const differences: string[] = [];
  if (current.season_year !== previous.season_year) differences.push(`Season: ${current.season_year} vs ${previous.season_year}`);
  if (current.calendar.race_count !== previous.calendar.race_count) differences.push(`Race count: ${current.calendar.race_count} vs ${previous.calendar.race_count}`);
  if (current.data_version !== previous.data_version) differences.push(`Data version: ${current.data_version} vs ${previous.data_version}`);

  const a = current.provenance?.scenario;
  const b = previous.provenance?.scenario;
  if (!a || !b) {
    differences.push("Full scenario settings are not recorded for both runs.");
  } else {
    const circuitsA = [...a.circuit_ids].sort().join(",");
    const circuitsB = [...b.circuit_ids].sort().join(",");
    if (circuitsA !== circuitsB) differences.push("Circuit selections differ.");
    if (a.max_consecutive !== b.max_consecutive) differences.push(`Maximum consecutive races: ${a.max_consecutive} vs ${b.max_consecutive}`);
    const breakA = a.summer_break_start === null || a.summer_break_end === null ? "none" : `${a.summer_break_start + 1}-${a.summer_break_end + 1}`;
    const breakB = b.summer_break_start === null || b.summer_break_end === null ? "none" : `${b.summer_break_start + 1}-${b.summer_break_end + 1}`;
    if (breakA !== breakB) differences.push(`Summer break weeks: ${breakA} vs ${breakB}`);
    if (a.pin_end_to_dec_week1 !== b.pin_end_to_dec_week1) differences.push("Finale pin settings differ.");
  }
  return differences;
}

function activeConstraintScore(run: RunPayload): string {
  const { passed, active } = summarizeActiveConstraints(run);
  return `${passed}/${active}`;
}

export function PlanComparison({ run }: { run: RunPayload }) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState<RunPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Ensure this run is saved before building the comparison list.
    saveRun(run);
    setOptions(recentRunIds().filter((id) => id !== run.run_id));
    setSelected("");
    setOther(null);
  }, [run.run_id]);

  useEffect(() => {
    if (!selected) return;
    // Load from session storage only — the backend does not retain run history.
    const result = getRun(selected);
    if (result) {
      setOther(result);
      setError("");
    } else {
      setOther(null);
      setError("That earlier result is no longer available in this browser session.");
    }
  }, [selected]);

  if (options.length === 0) return null;
  const rows: Array<[string, string, string]> = other ? [
    ["Travel distance", `${metric(run.metrics.total_distance_km)} km`, `${metric(other.metrics.total_distance_km)} km`],
    ["Longest leg", `${metric(run.metrics.longest_hop_km)} km`, `${metric(other.metrics.longest_hop_km)} km`],
    ["Legs over 5,000 km", metric(run.metrics.hops_over_5000_km), metric(other.metrics.hops_over_5000_km)],
    ["Region re-entries", metric(run.metrics.region_backtracks), metric(other.metrics.region_backtracks)],
    ["Active constraints passed", activeConstraintScore(run), activeConstraintScore(other)],
  ] : [];
  const differences = other ? scenarioDifferences(run, other) : [];

  return (
    <section aria-label="Plan comparison" className="rounded-xl border border-hairline bg-card p-4">
      <h2 className="font-display text-[16px] font-medium">Compare plans</h2>
      <label htmlFor="compare-run" className="mt-3 block font-tel text-sm text-mute">Compare with a previous run from this browser</label>
      <select id="compare-run" value={selected} onChange={(event) => { setSelected(event.target.value); setOther(null); setError(""); }} className="mt-1 min-h-11 w-full max-w-md rounded-lg border border-hairline bg-card px-3 text-sm">
        <option value="">Select a run</option>
        {options.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
      {error && <p role="alert" className="mt-2 text-sm text-rosso-ink">{error}</p>}
      {selected && !other && !error && <p role="status" className="mt-2 text-sm text-mute">Loading comparison…</p>}
      {other && (
        <div className="mt-3 overflow-x-auto">
          <div className="mb-3 rounded-lg border border-hairline bg-base/50 p-3 text-sm">
            <p className="font-medium">{differences.length === 0 ? "Equivalent scenario settings" : "Scenario differences"}</p>
            {differences.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-mute">
                {differences.map((difference) => <li key={difference}>{difference}</li>)}
              </ul>
            ) : (
              <p className="mt-1 text-mute">The metrics below are based on matching season, venues, constraints, and dataset.</p>
            )}
          </div>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead><tr className="border-b border-hairline"><th className="py-2 pr-3 font-medium">Measure</th><th className="py-2 pr-3 font-medium">Current plan</th><th className="py-2 font-medium">Previous plan</th></tr></thead>
            <tbody>{rows.map(([label, current, previous]) => <tr key={label} className="border-b border-hairline"><th className="py-2 pr-3 font-normal text-mute">{label}</th><td className="py-2 pr-3 font-tel tabular-nums">{current}</td><td className="py-2 font-tel tabular-nums">{previous}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
