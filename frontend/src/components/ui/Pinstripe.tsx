// Brand pinstripe: Rosso + Giallo bar under headers and above footers.
// High-visibility counterpart to the carbon surfaces.
export function Pinstripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-1 w-full ${className}`}
      style={{ background: "linear-gradient(to right, #e10600 0 55%, #ffeb00 55% 100%)" }}
    />
  );
}
