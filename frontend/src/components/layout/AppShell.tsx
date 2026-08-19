"use client";

import { useEffect, useState } from "react";

import { CommandPalette } from "./CommandPalette";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * Page frame: header, the skip link, the content column and the palette.
 *
 * ⌘K / Ctrl+K is bound once here rather than in the palette itself, so the
 * shortcut works from anywhere without the palette having to be mounted.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>

      <TopBar onOpenCommandPalette={() => setPaletteOpen(true)} />

      <main id="main" className={styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <p>
          Kosh — built for the Digital Alpha take-home. Next.js, FastAPI and
          PostgreSQL&nbsp;18.
        </p>
        <p className={styles.footerHint}>
          Press <kbd>⌘K</kbd> for the command palette.
        </p>
      </footer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
