"use client";

// Consistent, readable section title across the workstation.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[16px] font-medium">{children}</h2>;
}
