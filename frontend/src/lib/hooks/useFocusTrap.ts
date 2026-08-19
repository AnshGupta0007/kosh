"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Trap focus inside an overlay, hand-rolled.
 *
 * Everything an accessible dialog owes the user, in one place:
 *   - focus moves into the dialog when it opens
 *   - Tab and Shift+Tab cycle within it and never escape to the page behind
 *   - Escape closes it
 *   - focus returns to whatever opened it on close
 *   - the page behind cannot scroll while it is open
 *
 * The scrollbar-width padding matters: without it, hiding the body's
 * scrollbar shifts the whole layout sideways the moment a modal opens.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    // Focus the first control, or the dialog itself if it has none yet.
    const first = focusables()[0];
    (first ?? container)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = elements[0]!;
      const lastElement = elements[elements.length - 1]!;
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [active, containerRef, onClose]);
}
