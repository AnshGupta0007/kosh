"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number towards its target.
 *
 * Used on the figures that carry the story — the headline spend, the coin
 * balance. It exists for one real reason beyond decoration: when a redeem
 * debits the balance, watching it *travel* from 3,62,629 to 3,60,129 makes
 * the cause and effect legible in a way that a value swap does not.
 *
 * Honours prefers-reduced-motion by jumping straight to the target, and
 * uses one rAF loop that cancels on unmount.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;

    if (reduced || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo: fast out of the gate, long settle. Reads as "landing on"
      // a figure rather than sliding to it.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, duration]);

  return value;
}
