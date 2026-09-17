"use client";

interface Props {
  disabled: boolean;
  disabledReason: string | null;
  running: boolean;
  summary: string;
  onOptimize: () => void;
}

// Command center: one primary action with its exact input summary.
// Running shows phase/status text only — never fake solver percentages.
export function OptimizationCommand({ disabled, disabledReason, running, summary, onOptimize }: Props) {
  return (
    <section aria-label="Optimization command" className="rounded-lg border border-rosso/40 bg-card p-4 text-center">
      <p className="font-tel text-xs tracking-widest text-mute uppercase">{summary}</p>
      <button
        type="button"
        onClick={onOptimize}
        disabled={disabled || running}
        className="mt-2 rounded bg-rosso px-6 py-2.5 font-display text-base font-bold tracking-widest text-white uppercase transition-colors hover:bg-rosso-hi disabled:opacity-40 disabled:hover:bg-rosso"
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
          <p className="font-tel text-sm text-mute">Constructing feasible calendar…</p>
          <div className="mt-1 h-1 overflow-hidden rounded bg-lift" aria-hidden="true">
            <div className="speedline-bar h-full w-2/5 bg-rosso" />
          </div>
          <p className="mt-1 text-sm text-mute">Evaluating route efficiency. Typical runs take 15–20 seconds.</p>
        </div>
      )}
    </section>
  );
}
