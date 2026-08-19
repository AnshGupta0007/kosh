"use client";

import { useEffect, useState } from "react";

/**
 * Delay a fast-changing value.
 *
 * Used for search-as-you-type: the input stays instant (it holds its own
 * local state) while the request only fires once the user pauses, which
 * keeps a 10,000-row search from issuing a query per keystroke.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
