// Brand pinstripe: one high-visibility accent at the page boundary.
export function Pinstripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-1 w-full ${className}`}
      style={{ background: "linear-gradient(to right, var(--rosso) 0 55%, var(--giallo) 55% 100%)" }}
    />
  );
}
