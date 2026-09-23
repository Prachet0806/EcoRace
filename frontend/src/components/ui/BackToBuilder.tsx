"use client";

interface Props {
  onClick: () => void;
  label?: string;
}

// Chamfered back button (cut corners, motorsport voice). Shared so the
// TopBar and results page stay identical. Accessible name preserved.
export function BackToBuilder({ onClick, label = "← Back to scenario builder" }: Props) {
  return (
    <span className="chamfer-wrap chamfer-strong">
      <button type="button" onClick={onClick} className="chamfer-btn chamfer-btn-strong">
        {label}
      </button>
    </span>
  );
}
