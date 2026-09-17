// Tricolore pinstripe: the single literal Italian-flag reference in the UI.
// Thin gradient bar (green/white/red) used under headers and above footers.
export function Pinstripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[3px] w-full ${className}`}
      style={{ background: "linear-gradient(to right, #009246 0 33%, #f5f5f4 33% 66%, #e10600 66% 100%)" }}
    />
  );
}
