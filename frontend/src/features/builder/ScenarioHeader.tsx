"use client";

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
    <header className="border-b border-hairline pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mb-2 text-sm text-mute">{kicker}</p>
          <h1 className="font-display text-3xl font-medium leading-tight md:text-4xl">{title}</h1>
          <p className="mt-2 font-tel text-sm text-mute">{meta}</p>
        </div>
        {badge}
      </div>
    </header>
  );
}
