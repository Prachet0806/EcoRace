"use client";

interface Props {
  disabled: boolean;
  disabledReason: string | null;
  running: boolean;
  onOptimize: () => void;
}

export function OptimizeButton({ disabled, disabledReason, running, onOptimize }: Props) {
  return (
    <div>
      <button
        type="button"
        onClick={onOptimize}
        disabled={disabled || running}
        className="rounded bg-rosso px-5 py-2 font-display text-sm font-bold tracking-widest text-white uppercase transition-colors hover:bg-rosso-hi disabled:opacity-40 disabled:hover:bg-rosso"
      >
        {running ? "Optimizing…" : "Optimize Calendar"}
      </button>
      {disabledReason && !running && (
        <p role="status" className="mt-1 font-tel text-sm text-mute">
          {disabledReason}
        </p>
      )}
      {running && (
        <div className="mt-2 max-w-md" role="status" aria-live="polite">
          <div className="h-1 overflow-hidden rounded bg-lift" aria-hidden="true">
            <div className="speedline-bar h-full w-2/5 bg-rosso" />
          </div>
          <p className="mt-1 text-sm text-mute">Solving… typical runs take 15–20 seconds. You can wait on this page.</p>
        </div>
      )}
    </div>
  );
}
