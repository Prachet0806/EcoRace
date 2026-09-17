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
    <div className="border-b border-hairline pb-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="group text-left"
          aria-label="EcoRace planner home"
        >
          <span className="block font-display text-3xl font-extrabold tracking-tight italic md:text-4xl">
            EcoRace <span className="text-rosso">Planner</span>
          </span>
          <span className="mt-1 block font-tel text-xs font-semibold tracking-[0.25em] text-giallo uppercase">
            Calendar workstation
          </span>
        </button>
        <div className="flex items-center gap-2 pb-1">
          {runId && (
            <span className="rounded border border-giallo/40 bg-giallo/10 px-2 py-1 font-tel text-xs text-giallo">
              {runId}
            </span>
          )}
          {onBack && <BackToBuilder onClick={onBack} />}
        </div>
      </div>
      <Pinstripe className="mt-3" />
    </div>
  );
}
