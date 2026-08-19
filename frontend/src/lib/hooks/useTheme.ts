"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "kosh-theme";

/**
 * Theme state.
 *
 * The initial value is applied by a blocking script in the document head,
 * before first paint, so there is no flash of the wrong theme. This hook
 * only reads what that script decided and handles changes afterwards.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing: the theme just will not persist. Not fatal.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** Runs before paint; kept as a string so it can be inlined in <head>. */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = stored || (prefersLight ? "light" : "dark");
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;
