import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, type?: Toast["type"], duration?: number) => string;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type = "info", duration = 5000) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));