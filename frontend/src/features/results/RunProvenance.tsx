"use client";

import type { RunPayload } from "@/lib/types";

// Run provenance: reproducibility surfaced as product copy. Every field
// comes from the stored run payload — never reconstructed or invented.
export function RunProvenance({ run, source }: { run: RunPayload; source: "session" | "api" }) {
  const rows: Array<[string, string]> = [
    ["Run ID", run.run_id],
    ["Data version", run.data_version],
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
