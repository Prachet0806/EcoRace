"use client";

import type { RunPayload } from "@/lib/types";

const LABELS: Record<string, string> = {
  weather: "Weather feasibility",
  max_consecutive_3: "Max 3 consecutive races",
  race_count_unique: "Race count & uniqueness",
};

export function ConstraintDiagnostics({ run }: { run: RunPayload }) {
  return (
    <section aria-label="Constraint diagnostics" className="rounded-lg border border-hairline bg-card p-3">
      <h2 className="mb-2 font-display text-sm font-bold tracking-widest uppercase">Constraints</h2>
      <ul className="space-y-2 text-sm">
        {run.constraints.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-2">
            <span
              aria-label={c.satisfied ? "satisfied" : "violated"}
              className={`rounded px-1.5 py-0.5 font-tel text-xs font-semibold ${
                c.satisfied ? "bg-pass/15 text-pass" : "bg-rosso/15 text-rosso"
              }`}
            >
              {c.satisfied ? "PASS" : "FAIL"}
            </span>
            <span className="font-medium">{LABELS[c.name] ?? c.name}</span>
            {!c.satisfied && (
              <ul className="ml-6 basis-full list-disc text-mute">
                {c.violations.map((v, i) => (
                  <li key={i}>
                    <span className="font-tel">{v.code}</span>: {v.message}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
