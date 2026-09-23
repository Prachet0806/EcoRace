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
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[280px] max-w-[400px] animate-slide-in ${
            toast.type === "error"
              ? "bg-rosso/10 border-rosso text-rosso"
              : toast.type === "success"
              ? "bg-green-600/10 border-green-600 text-green-600"
              : toast.type === "warning"
              ? "bg-amber-600/10 border-amber-600 text-amber-600"
              : "bg-blue-600/10 border-blue-600 text-blue-600"
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