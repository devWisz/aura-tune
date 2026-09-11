import { create } from "zustand";

export type ToastTone = "info" | "success" | "warn" | "error";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-4) }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.tone === "error" ? 7000 : 4500);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for modules outside React. */
export const toast = {
  info: (title: string, body?: string) => useToastStore.getState().push({ title, body, tone: "info" }),
  success: (title: string, body?: string) => useToastStore.getState().push({ title, body, tone: "success" }),
  warn: (title: string, body?: string) => useToastStore.getState().push({ title, body, tone: "warn" }),
  error: (title: string, body?: string) => useToastStore.getState().push({ title, body, tone: "error" }),
};
