"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { recentRunIds, rememberRun } from "@/lib/recent-runs";
import type { RunPayload } from "@/lib/types";

function metric(value: number | undefined): string {
  return value === undefined ? "Not recorded" : Math.round(value).toLocaleString("en-US");
}

export function PlanComparison({ run }: { run: RunPayload }) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState<RunPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    rememberRun(run.run_id);
    setOptions(recentRunIds().filter((id) => id !== run.run_id));
    setSelected("");
    setOther(null);
  }, [run.run_id]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    api.getRun(selected).then((result) => {
      if (active) { setOther(result); setError(""); }
    }).catch(() => {
      if (active) { setOther(null); setError("That earlier result is unavailable in the current database."); }
    });
    return () => { active = false; };
  }, [selected]);

  if (options.length === 0) return null;
  const rows: Array<[string, string, string]> = other ? [
    ["Travel distance", `${metric(run.metrics.total_distance_km)} km`, `${metric(other.metrics.total_distance_km)} km`],
    ["Longest leg", `${metric(run.metrics.longest_hop_km)} km`, `${metric(other.metrics.longest_hop_km)} km`],
    ["Legs over 5,000 km", metric(run.metrics.hops_over_5000_km), metric(other.metrics.hops_over_5000_km)],
    ["Region re-entries", metric(run.metrics.region_backtracks), metric(other.metrics.region_backtracks)],
    ["Constraints passed", `${run.constraints.filter((c) => c.satisfied).length}/${run.constraints.length}`, `${other.constraints.filter((c) => c.satisfied).length}/${other.constraints.length}`],
  ] : [];

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
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead><tr className="border-b border-hairline"><th className="py-2 pr-3 font-medium">Measure</th><th className="py-2 pr-3 font-medium">Current plan</th><th className="py-2 font-medium">Previous plan</th></tr></thead>
            <tbody>{rows.map(([label, current, previous]) => <tr key={label} className="border-b border-hairline"><th className="py-2 pr-3 font-normal text-mute">{label}</th><td className="py-2 pr-3 font-tel tabular-nums">{current}</td><td className="py-2 font-tel tabular-nums">{previous}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
