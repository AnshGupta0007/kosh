"use client";

import { useEffect, useState } from "react";

/**
 * False during server render and the first client render; true after.
 *
 * Needed wherever client-fetched data would otherwise make the first client
 * render disagree with the server HTML. React compares the *first* client
 * render against the server output, so a value that has resolved by then —
 * a cached balance, for instance — is a hydration mismatch even though
 * nothing is logically wrong. Gating on this makes both sides render the
 * same placeholder, and the real value appears on the next paint.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
