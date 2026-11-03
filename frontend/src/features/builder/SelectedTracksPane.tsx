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
    <div className="flex h-full flex-col rounded-xl border border-hairline bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Your calendar</SectionLabel>
        {circuits.length > 0 && !locked && (
          <button type="button" onClick={onClear} className="text-sm text-mute underline hover:text-ink">
            Clear
          </button>
        )}
      </div>
      {locked && (
        <p className="mb-2 font-tel text-xs text-mute">Locked to official set</p>
      )}
      {/* Frozen e2e string: exact selected count. */}
      <p className="mb-2 font-tel text-xs text-mute">Selected ({circuits.length}) · optimizer chooses race order</p>
      {circuits.length === 0 ? (
        <div className="flex min-h-48 flex-1 flex-col justify-center rounded-lg border border-dashed border-hairline px-6 text-center">
          <p className="text-sm text-ink">No circuits selected</p>
          <p className="mt-2 text-sm leading-5 text-mute">
            Choose 20–24 circuits from the library. The optimizer will assign dates and order.
          </p>
        </div>
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
