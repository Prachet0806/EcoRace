"use client";

interface Props {
  tone: "ready" | "warn" | "error" | "info";
  children: React.ReactNode;
}

const TONES: Record<Props["tone"], string> = {
  ready: "bg-pass/15 text-pass",
  warn: "bg-giallo/15 text-giallo",
  error: "bg-rosso/15 text-rosso",
  info: "bg-lift text-mute",
};

// Small mono status chip. Colors carry fixed meanings: pass green, warn
// giallo, error rosso — never restyle per context.
export function StatusBadge({ tone, children }: Props) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-tel text-xs font-semibold ${TONES[tone]}`}>{children}</span>
  );
}
