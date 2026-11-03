"use client";

import { useEffect, useState } from "react";

interface Props {
  disabled: boolean;
  disabledReason: string | null;
  running: boolean;
  summary: string;
  onOptimize: () => void;
}

// Command center: one primary action with its exact input summary.
// Running shows elapsed time and an indeterminate bar, never a fake percentage.
export function OptimizationCommand({ disabled, disabledReason, running, summary, onOptimize }: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return (
    <section aria-label="Optimization command" className="rounded-xl border border-hairline bg-card p-5 text-center">
      <p className="font-tel text-xs leading-5 text-mute">{summary}</p>
      <button
        type="button"
        onClick={onOptimize}
        disabled={disabled || running}
        className="mt-3 min-h-11 rounded-lg bg-rosso px-6 py-2 font-display text-[16px] font-medium text-white transition-colors hover:bg-rosso-hi disabled:opacity-40 disabled:hover:bg-rosso"
      >
        {running ? "Optimizing…" : "→ Run optimization"}
      </button>
      {disabled && disabledReason && !running && (
        <p role="status" className="mt-1 font-tel text-sm text-mute">
          {disabledReason}
        </p>
      )}
      {running && (
        <div className="mx-auto mt-3 max-w-md" role="status" aria-live="polite">
          <p className="font-tel text-sm text-mute">Solver running · {elapsed}s elapsed</p>
          <div className="mt-1 h-1 overflow-hidden rounded bg-lift" aria-hidden="true">
            <div className="speedline-bar h-full w-2/5 bg-rosso" />
          </div>
          <p className="mt-1 text-sm text-mute">Checking calendar constraints and route distance. This may take tens of seconds.</p>
        </div>
      )}
    </section>
  );
}
