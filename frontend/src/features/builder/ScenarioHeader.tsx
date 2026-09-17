"use client";

import { Pinstripe } from "@/components/ui/Pinstripe";

interface Props {
  kicker: string;
  title: React.ReactNode;
  meta: string;
  badge: React.ReactNode;
}

// Product shell header shared by builder (DRAFT SCENARIO) and results
// (OPTIMIZATION RESULT) via the variant props. One coherent product bar.
export function ScenarioHeader({ kicker, title, meta, badge }: Props) {
  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-tel text-xs font-semibold tracking-widest text-giallo uppercase">{kicker}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight italic">{title}</h1>
          <p className="font-tel text-sm text-ink">{meta}</p>
        </div>
        {badge}
      </div>
      <Pinstripe className="mt-3" />
    </header>
  );
}
