"use client";

import type { RunPayload } from "@/lib/types";

// Run provenance: reproducibility surfaced as product copy. Every field
// comes from the stored run payload — never reconstructed or invented.
export function RunProvenance({ run, source }: { run: RunPayload; source: "session" | "api" }) {
  const rows: Array<[string, string]> = [
    ["Run ID", run.run_id],
    ["Data version", run.data_version],
    ["Weather policy", run.provenance ? `${run.provenance.weather_version}${run.provenance.weather_synthetic ? " (synthetic demo)" : ""}` : "not recorded"],
    ["Weather SHA-256", run.provenance?.weather_sha256 ?? "not recorded"],
    ["Circuit SHA-256", run.provenance?.circuits_sha256 ?? "not recorded"],
    ["Requested budget", run.provenance ? `${run.provenance.requested_budget_s}s` : "not recorded"],
    ["Seed schedule", run.provenance?.seed_schedule.join(", ") ?? "not recorded"],
    ["Executed seeds", run.provenance?.attempts.map((a) => a.seed).join(", ") ?? "not recorded"],
    ["Total execution time", run.provenance ? `${(run.provenance.total_runtime_ms / 1000).toFixed(1)}s` : "not recorded"],
    ["Solver", `${run.solver.name} ${run.solver.version}`.trim()],
    ["Seed", String(run.solver.seed)],
    ["Execution time", `${(run.solver.runtime_ms / 1000).toFixed(1)}s`],
    ["Solution source", run.solver.origin],
    ["Optimality", run.solver.optimality_proven ? "proven optimal" : "best found (not proven)"],
    ["Loaded from", source === "session" ? "this browser" : "API"],
  ];
  return (
    <section aria-label="Run information" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Run information</h2>
      <dl className="grid gap-x-6 gap-y-1 font-tel text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-hairline py-1">
            <dt className="text-mute">{k}</dt>
            <dd className="truncate text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
