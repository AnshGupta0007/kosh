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

/** Runs before paint; kept as a string so it can be inlined in <head>.
 *
 * Dark is the product's default, not the operating system's preference.
 * Kosh is designed dark-first — the card, the gold and the ambient light all
 * assume it — so a visitor on a light-mode machine should still see the app
 * as intended. A stored choice always wins; the OS is not consulted.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;
