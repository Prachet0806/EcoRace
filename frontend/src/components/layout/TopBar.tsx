"use client";

import { useRouter } from "next/navigation";
import { BackToBuilder } from "@/components/ui/BackToBuilder";
import { Pinstripe } from "@/components/ui/Pinstripe";

interface Props {
  runId?: string;
  onBack?: () => void;
}

// Product top bar: amplified brand block + workflow + scenario/run status.
// No SaaS nav.
export function TopBar({ runId, onBack }: Props) {
  const router = useRouter();
  return (
    <div className="border-b border-hairline pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="group text-left"
          aria-label="EcoRace planner home"
        >
          <span className="block font-display text-2xl font-bold tracking-tight italic md:text-3xl">
            EcoRace <span className="text-rosso-ink">Planner</span>
          </span>
          <span className="mt-1 block text-xs text-mute">
            Calendar workstation
          </span>
        </button>
        <div className="flex items-center gap-2 pb-1">
          {runId && (
            <span className="rounded-md border border-hairline px-2 py-1 font-tel text-xs text-mute">
              {runId}
            </span>
          )}
          {onBack && <BackToBuilder onClick={onBack} />}
        </div>
      </div>
      <Pinstripe className="mt-4" />
    </div>
  );
}
