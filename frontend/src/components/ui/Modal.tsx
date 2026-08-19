"use client";

import { useCallback, useId, useRef } from "react";

import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

import { Portal } from "./Portal";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md";
  /** Blocks backdrop and Escape dismissal while a request is in flight. */
  busy?: boolean;
}

/**
 * Hand-built dialog — no component library.
 *
 * role="dialog" + aria-modal, labelled by its own heading and described by
 * its own body text, focus trapped, Escape to close, click-outside to close,
 * and focus returned to the trigger afterwards. While `busy`, both dismissal
 * routes are disabled so a half-finished redeem cannot be closed out from
 * under itself.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  busy = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useFocusTrap(dialogRef, open, handleClose);

  if (!open) return null;

  return (
    <Portal>
      <div className={styles.overlay}>
        {/* The backdrop is a sibling, not a parent: a click on the dialog
            itself must never bubble into a dismissal. */}
        <div className={styles.backdrop} onClick={handleClose} aria-hidden />
        <div
          ref={dialogRef}
          className={`${styles.dialog} ${styles[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={handleClose}
              disabled={busy}
              aria-label="Close dialog"
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

          {description ? (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          ) : null}

          <div className={styles.body}>{children}</div>

          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      </div>
    </Portal>
  );
}
