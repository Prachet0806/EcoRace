"use client";

import { useToastStore } from "@/lib/useToastStore";

export function Toaster() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex min-w-[280px] max-w-[400px] items-center gap-3 rounded-lg border bg-card px-4 py-3 ${
            toast.type === "error"
              ? "border-rosso-ink/40 text-rosso-ink"
              : toast.type === "success"
              ? "border-hairline text-pass"
              : toast.type === "warning"
              ? "border-hairline text-giallo"
              : "border-hairline text-ink"
          }`}
          role="alert"
        >
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            type="button"
            onClick={() => remove(toast.id)}
            className="text-current/60 hover:text-current transition-colors"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
