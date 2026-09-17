"use client";

// Eyebrow section label: display font, tracked, muted. Single place for the
// workstation's information hierarchy voice.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-sm font-bold tracking-widest uppercase">{children}</h2>;
}
