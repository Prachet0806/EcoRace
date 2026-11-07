"use client";

import type { SummerBreak } from "@/lib/scenario-store";

interface Props {
  disabled: boolean;
  disabledReason: string | null;
  running: boolean;
  selectedCount: number;
  seasonYear: number;
  maxConsecutive: number;
  summerBreak: SummerBreak | null | undefined;
  pinEnd: boolean;
  apiError: string | null;
  onOptimize: () => void;
}

export function OptimizationCommand({
  disabled,
  disabledReason,
  running,
  selectedCount,
  seasonYear,
  maxConsecutive,
  summerBreak,
  pinEnd,
  apiError,
  onOptimize,
}: Props) {
  const isReady = !disabled && !running;

  // Contextual readiness status line
  let statusText: string;
  let statusTone: "ready" | "warn" | "error" | "running";

  if (running) {
    statusText = "Optimization is in progress";
    statusTone = "running";
  } else if (apiError) {
    statusText = "The circuit library or optimization service is unavailable";
    statusTone = "error";
  } else if (disabled && disabledReason) {
    statusText = disabledReason;
    statusTone = "warn";
  } else if (isReady) {
    statusText = "Your scenario is ready to optimize";
    statusTone = "ready";
  } else {
    statusText = "Configure your scenario to proceed";
    statusTone = "warn";
  }

  return (
    <section aria-label="Optimization command" className="rounded-xl border border-hairline bg-card p-6">
      {/* Part 1: Scenario Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/60 pb-4">
        <div>
          <span className="font-tel text-xs font-semibold uppercase tracking-wider text-mute">
            Ready to optimize?
          </span>
          <h2 className="font-display text-lg font-medium text-ink mt-0.5">
            Scenario summary
          </h2>
        </div>
        <span
          className={`rounded-md px-3 py-1 font-tel text-xs font-medium ${
            isReady ? "bg-pass/15 text-pass" : "bg-lift text-mute"
          }`}
        >
          {isReady ? "Ready" : "Incomplete"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-hairline/70 bg-base/50 p-3">
          <span className="font-tel text-[11px] uppercase tracking-wider text-mute block">Circuits</span>
          <span className="font-tel text-xl font-medium text-ink">{selectedCount}</span>
        </div>
        <div className="rounded-lg border border-hairline/70 bg-base/50 p-3">
          <span className="font-tel text-[11px] uppercase tracking-wider text-mute block">Season</span>
          <span className="font-tel text-xl font-medium text-ink">{seasonYear}</span>
        </div>
        <div className="rounded-lg border border-hairline/70 bg-base/50 p-3">
          <span className="font-tel text-[11px] uppercase tracking-wider text-mute block">Max consecutive</span>
          <span className="font-tel text-xl font-medium text-ink">{maxConsecutive} <span className="text-xs text-mute font-normal">races</span></span>
        </div>
        <div className="rounded-lg border border-hairline/70 bg-base/50 p-3">
          <span className="font-tel text-[11px] uppercase tracking-wider text-mute block">Summer break</span>
          <span className="font-tel text-base font-medium text-ink">
            {summerBreak ? `W${summerBreak.start + 1}–W${summerBreak.end + 1}` : "None"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-mute">
        Your configuration will be submitted to the EcoRace optimizer. The resulting calendar will be checked against the scheduling constraints.
      </p>

      {/* Part 2: Primary Action */}
      <div className="mt-6 flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={onOptimize}
          disabled={disabled || running}
          className="min-h-12 w-full max-w-md rounded-xl bg-rosso px-8 py-3 font-display text-lg font-medium text-white transition-all hover:bg-rosso-hi active:scale-[0.99] disabled:opacity-40 disabled:hover:bg-rosso disabled:active:scale-100 shadow-md"
        >
          {running ? "Optimizing…" : "→ Run optimization"}
        </button>
        <span className="font-tel text-xs text-mute mt-1.5">
          Run the EcoRace optimization engine
        </span>
      </div>

      {/* Part 3: Readiness Explanation */}
      <div className="mt-4 text-center">
        <p
          role="status"
          aria-live="polite"
          className={`font-tel text-xs font-medium ${
            statusTone === "ready"
              ? "text-pass"
              : statusTone === "error"
              ? "text-rosso-ink"
              : statusTone === "running"
              ? "text-giallo"
              : "text-mute"
          }`}
        >
          {statusText}
        </p>
      </div>
    </section>
  );
}
