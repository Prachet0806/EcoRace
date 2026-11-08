"use client";

import { useEffect, useState } from "react";

export type OptimizationPhase =
  | "idle"
  | "preparing"
  | "optimizing"
  | "validating"
  | "complete"
  | "error";

interface Props {
  phase: OptimizationPhase;
  elapsedSeconds: number;
}

const STAGES = [
  {
    id: "preparing",
    title: "1. Preparing scenario",
    description: "Request accepted and configuration submitted.",
  },
  {
    id: "optimizing",
    title: "2. Optimizing calendar",
    description: "The optimization request is being processed. Solver progress is not streamed.",
  },
  {
    id: "validating",
    title: "3. Validating solution",
    description: "The returned schedule will be checked against the constraints.",
  },
  {
    id: "complete",
    title: "4. Complete",
    description: "Your calendar will be displayed when the response is received and accepted.",
  },
];

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function OptimizationProgress({ phase, elapsedSeconds }: Props) {
  const phaseOrder: Record<string, number> = {
    idle: 0,
    preparing: 1,
    optimizing: 2,
    validating: 3,
    complete: 4,
    error: -1,
  };

  const currentIdx = phaseOrder[phase] ?? 0;

  return (
    <section
      aria-label="Optimization progress"
      aria-live="polite"
      className="mx-auto my-6 max-w-2xl rounded-2xl border border-hairline bg-card p-6 md:p-8 shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/60 pb-4">
        <div>
          <span className="font-tel text-xs font-semibold text-mute">Optimizing your calendar</span>
          <h2 className="font-display text-2xl font-medium text-ink mt-1">Finding your best route</h2>
        </div>
        <span className="rounded-md border border-giallo/30 bg-giallo/15 px-3 py-1 font-tel text-xs font-medium text-giallo">
          In progress
        </span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-mute">
        EcoRace is evaluating possible race schedules against your selected circuits and calendar constraints.
      </p>

      {/* Progress Stages */}
      <div className="mt-6 space-y-3">
        {STAGES.map((stg, i) => {
          const stepNum = i + 1;
          const isDone = currentIdx > stepNum;
          const isActive = currentIdx === stepNum;
          const isPending = currentIdx < stepNum;

          return (
            <div
              key={stg.id}
              className={`rounded-xl border p-4 transition-colors ${isActive
                  ? "border-rosso bg-lift/80"
                  : isDone
                    ? "border-hairline bg-base/50"
                    : "border-hairline/50 bg-card opacity-50"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-medium text-ink flex items-center gap-2">
                  {isDone ? (
                    <span aria-hidden="true" className="font-tel text-pass text-xs font-bold">✓</span>
                  ) : isActive ? (
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-rosso" />
                  ) : (
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-mute/40" />
                  )}
                  {stg.title}
                </span>
                <span
                  className={`font-tel text-xs font-medium ${isDone ? "text-pass" : isActive ? "text-rosso-ink" : "text-mute"
                    }`}
                >
                  {isDone ? "Complete" : isActive ? "In progress" : "Pending"}
                </span>
              </div>
              <p className="mt-1 text-xs text-mute pl-4">{stg.description}</p>
              {isActive && (
                <div className="mt-3 h-1 overflow-hidden rounded bg-lift" aria-hidden="true">
                  <div className="speedline-bar h-full w-2/5 bg-rosso" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Elapsed time footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline/80 bg-base/50 p-4">
        <div>
          <span className="font-tel text-[11px] uppercase tracking-wider text-mute block">Elapsed time</span>
          <span className="font-tel text-2xl font-medium tabular-nums text-ink">{fmtTime(elapsedSeconds)}</span>
        </div>
        <p className="font-tel text-xs text-mute text-right max-w-xs">
          Please keep this page open while your calendar is being generated.
        </p>
      </div>
    </section>
  );
}

