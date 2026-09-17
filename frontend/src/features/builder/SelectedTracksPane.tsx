"use client";

import { CircuitRow } from "@/features/builder/CircuitRow";
import { SectionLabel } from "@/features/shared/SectionLabel";
import type { Circuit } from "@/lib/types";

interface Props {
  circuits: Circuit[]; // selected, in selection order
  seasonYear: number;
  locked: boolean;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function SelectedTracksPane({ circuits, seasonYear, locked, onToggle, onClear }: Props) {
  return (
    <div className="rounded-lg border border-hairline bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Your calendar</SectionLabel>
        {circuits.length > 0 && !locked && (
          <button type="button" onClick={onClear} className="text-sm text-mute underline hover:text-ink">
            Clear
          </button>
        )}
      </div>
      {locked && (
        <p className="mb-2 font-tel text-xs tracking-widest text-mute uppercase">Locked to official set</p>
      )}
      {/* Frozen e2e string: exact selected count. */}
      <p className="mb-2 font-tel text-xs text-mute">Selected ({circuits.length}) · selection order preserved</p>
      {circuits.length === 0 ? (
        <p className="text-sm text-mute">No tracks selected yet. Pick from the available list.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto" aria-label="Selected tracks">
          {circuits.map((c, i) => (
            <li key={c.id}>
              <CircuitRow circuit={c} seq={i + 1} seasonYear={seasonYear} disabled={locked} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
