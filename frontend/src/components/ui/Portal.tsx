"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Render children at the end of <body>.
 *
 * Overlays have to escape the transform and overflow contexts of whatever
 * card they were triggered from, or they end up clipped.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
