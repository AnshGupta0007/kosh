"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Portal } from "./Portal";
import styles from "./Toast.module.css";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, string> = { success: "✓", error: "!", info: "i" };

/**
 * Toasts live in a polite live region, so a screen reader announces a failed
 * redeem without stealing focus from wherever the user is.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...toast, id }]);
      // Errors linger: the user needs time to read what went wrong.
      setTimeout(() => dismiss(id), toast.tone === "error" ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div className={styles.viewport} role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
              <span className={styles.icon} aria-hidden>
                {ICONS[toast.tone]}
              </span>
              <div className={styles.content}>
                <p className={styles.title}>{toast.title}</p>
                {toast.message ? <p className={styles.message}>{toast.message}</p> : null}
              </div>
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path
                    d="M1.5 1.5l7 7M8.5 1.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
