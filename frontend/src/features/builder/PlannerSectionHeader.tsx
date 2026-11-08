"use client";

interface Props {
  step: string;
  title: string;
  description: string;
}

// Centered editorial section header with numbered eyebrow
export function PlannerSectionHeader({ step, title, description }: Props) {
  return (
    <div className="py-6 text-center">
      <p className="font-tel text-xs font-semibold text-rosso-label">
        {step}
      </p>
      <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-mute">
        {description}
      </p>
    </div>
  );
}

