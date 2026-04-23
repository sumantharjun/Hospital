"use client";

import { useState, useCallback } from "react";
import Toast from "@/components/Toast";

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

let toastId = 0;
const toastListeners: Array<(toast: ToastMessage | null) => void> = [];

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage["type"] = "info") => {
    const id = `toast-${++toastId}`;
    const newToast = { id, message, type };
    setToasts((prev) => [...prev, newToast]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

