"use client";

interface Props {
  kicker: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta: React.ReactNode;
  badge: React.ReactNode;
  centered?: boolean;
}

// Product shell header shared by builder (DRAFT SCENARIO) and results
// (OPTIMIZATION RESULT) via the variant props. Supports centered editorial visual anchor.
export function ScenarioHeader({ kicker, title, description, meta, badge, centered = false }: Props) {
  if (centered) {
    return (
      <header className="border-b border-hairline py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <p className="font-tel text-xs font-semibold text-mute">
            {kicker}
          </p>
          <span className="text-mute/40">·</span>
          {badge}
        </div>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-mute">
            {description}
          </p>
        )}
        {meta && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pt-3">
            {meta}
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="border-b border-hairline pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-tel text-xs font-semibold uppercase tracking-wider text-mute">{kicker}</p>
          <h1 className="mt-1 font-display text-3xl font-medium leading-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-mute">{description}</p>}
        </div>
        <div>{badge}</div>
      </div>
      {meta && <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 text-sm border-t border-hairline/60">{meta}</div>}
    </header>
  );
}
