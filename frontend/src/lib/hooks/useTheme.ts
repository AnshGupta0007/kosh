"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "kosh-theme";

/**
 * Theme state.
 *
 * The initial value is applied by a blocking script in the document head,
 * before first paint, so there is no flash of the wrong theme. This hook
 * only reads what that script decided and handles changes afterwards.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === "light" ? "dark" : "light";
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

/** Runs before paint; kept as a string so it can be inlined in <head>.
 *
 * Light is the product's default, not the operating system's preference.
 * Kosh is designed light-first — it is a statement, and a statement is read
 * on paper — so every visitor sees it as intended. A stored choice always
 * wins; the OS is not consulted.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    document.documentElement.dataset.theme = stored === "dark" ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;
