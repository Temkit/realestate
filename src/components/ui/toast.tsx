"use client";

import { X, Check, AlertCircle } from "lucide-react";
import type { Toast } from "@/hooks/use-toast";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border shadow-lg
                     animate-fade-in-up"
        >
          {toast.type === "success" && (
            <Check className="h-4 w-4 text-primary shrink-0" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
