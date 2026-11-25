"use client";

import { useState } from "react";
import type { CalendarSource } from "@/lib/scenario-store";

interface Props {
  source: CalendarSource;
  officialCount: number;
  selectedCount: number;
  onChange: (s: CalendarSource) => void;
}

// Calendar source selector: distinct custom vs official preset modes with clear
// descriptions, official venue count indicator, locked status explanation,
// and confirmation dialog before replacing an existing custom selection.
export function CalendarSourceSelector({ source, officialCount, selectedCount, onChange }: Props) {
  const [confirmPending, setConfirmPending] = useState(false);

  const handleSelect = (next: CalendarSource) => {
    if (next === source) return;
    if (next === "official-2026-venues" && selectedCount > 0) {
      setConfirmPending(true);
      return;
    }
    onChange(next);
  };

  const handleConfirmSwitch = () => {
    setConfirmPending(false);
    onChange("official-2026-venues");
  };

  return (
    <section aria-label="Calendar source" className="rounded-xl border border-hairline bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-display text-base font-medium text-ink">Choose your calendar source</h2>
          <p className="text-xs text-mute mt-0.5">
            Switching modes defines how your circuits and race count are configured.
          </p>
        </div>
        {source === "official-2026-venues" && (
          <span className="rounded-md border border-hairline bg-lift px-2.5 py-1 font-tel text-xs text-mute">
            Official venue set active · editing locked
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="Calendar source">
        {/* Custom Mode */}
        <button
          type="button"
          onClick={() => handleSelect("custom")}
          aria-pressed={source === "custom"}
          className={`relative rounded-xl border p-4 text-left transition-colors ${
            source === "custom"
              ? "border-rosso bg-lift/80 shadow-sm"
              : "border-hairline bg-card hover:bg-lift/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-[15px] font-medium">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${source === "custom" ? "bg-rosso" : "bg-mute/40"}`}
              />
              Custom calendar
            </span>
            {source === "custom" && (
              <span className="rounded bg-rosso/15 px-2 py-0.5 font-tel text-[11px] font-medium text-rosso-ink">
                Selected
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            Choose your own circuits (20–24) and configure target race count manually.
          </p>
          {source === "official-2026-venues" && (
            <p className="mt-2 text-[11px] text-mute/80">
              Returning to Custom will start a fresh draft selection.
            </p>
          )}
        </button>

        {/* Official 2026 Preset Mode */}
        <button
          type="button"
          onClick={() => handleSelect("official-2026-venues")}
          aria-pressed={source === "official-2026-venues"}
          className={`relative rounded-xl border p-4 text-left transition-colors ${
            source === "official-2026-venues"
              ? "border-rosso bg-lift/80 shadow-sm"
              : "border-hairline bg-card hover:bg-lift/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-[15px] font-medium">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${source === "official-2026-venues" ? "bg-rosso" : "bg-mute/40"}`}
              />
              Official season
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded border border-hairline px-2 py-0.5 font-tel text-[11px] text-mute">
                {officialCount} venues
              </span>
              {source === "official-2026-venues" && (
                <span className="rounded bg-rosso/15 px-2 py-0.5 font-tel text-[11px] font-medium text-rosso-ink">
                  Selected
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            Load the predefined 2026 venue set ({officialCount} circuits). The optimizer assigns dates and order.
          </p>
          <p className="mt-2 text-[11px] text-mute/80">
            {source === "official-2026-venues"
              ? "Circuit editing and race count controls are locked while this preset is active."
              : "Switching to the official preset replaces your current circuit selection."}
          </p>
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmPending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-official-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-xl">
            <h3 id="confirm-official-title" className="font-display text-lg font-medium text-ink">
              Replace current selection?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-mute">
              You currently have <span className="font-tel text-ink font-semibold">{selectedCount}</span> circuit
              {selectedCount === 1 ? "" : "s"} selected. Loading the official 2026 preset will replace your selection
              with the predefined {officialCount}-venue calendar.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmPending(false)}
                className="rounded-lg border border-hairline px-4 py-2 font-tel text-xs font-medium text-mute hover:bg-lift hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                className="rounded-lg bg-rosso px-4 py-2 font-tel text-xs font-medium text-white hover:bg-rosso-hi"
              >
                Replace with Official Set
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
