"use client";

import { useEffect, useState } from "react";

/**
 * Match a media query in JS.
 *
 * Layout is CSS's job — this is only for the few places where the *markup*
 * has to differ, such as swapping a chart's legend position.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
