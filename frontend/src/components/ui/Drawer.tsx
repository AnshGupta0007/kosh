"use client";

import { useId, useRef } from "react";

import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

import { Portal } from "./Portal";
import styles from "./Drawer.module.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Slide-over panel, built on the same focus-trap primitive as the modal.
 *
 * Used for transaction detail because the row context stays visible behind
 * it — a modal would cover the table the user is working through. Below
 * 640px it becomes a bottom sheet, which is the reachable half of a phone.
 */
export function Drawer({ open, onClose, title, eyebrow, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return (
    <Portal>
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} aria-hidden />
        <div
          ref={panelRef}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className={styles.header}>
            <div>
              {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close panel"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M2.5 2.5l9 9M11.5 2.5l-9 9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className={styles.body}>{children}</div>

          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      </div>
    </Portal>
  );
}
