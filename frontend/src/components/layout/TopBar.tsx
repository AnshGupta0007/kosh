"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CoinAmount, Skeleton } from "@/components/ui";
import { formatNumber, formatRupeesWhole } from "@/lib/format";
import { useBalance } from "@/lib/hooks/useApi";
import { useMounted } from "@/lib/hooks/useMounted";
import { useTheme } from "@/lib/hooks/useTheme";

import styles from "./TopBar.module.css";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/rewards", label: "Rewards" },
  { href: "/data-health", label: "Data health" },
];

interface TopBarProps {
  onOpenCommandPalette: () => void;
}

/**
 * The app header.
 *
 * The coin balance lives here rather than on the rewards page, so it is
 * visible on every screen — that is a requirement of the product, and it is
 * also the number people actually want to keep an eye on. It animates on
 * change, which is what makes an optimistic redeem feel instantaneous.
 */
export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const pathname = usePathname();
  const { data: balance, isPending } = useBalance();
  const { theme, toggle } = useTheme();
  const mounted = useMounted();

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.16" />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <path
                d="M9 7v10M9 12l5-5M9 12l5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </span>
          <span className={styles.wordmark}>Kosh</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navActive : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <button type="button" className={styles.command} onClick={onOpenCommandPalette}>
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
              <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M9.4 9.4L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className={styles.commandLabel}>Jump to…</span>
            <kbd className={styles.kbd}>⌘K</kbd>
          </button>

          <div className={styles.balance} title="Your coin balance">
            {!mounted || isPending || !balance ? (
              <Skeleton width="88px" height="18px" />
            ) : (
              <>
                <CoinAmount coins={formatNumber(balance.balance)} size="md" />
                <span className={styles.balanceWorth}>
                  ≈ {formatRupeesWhole(balance.balance * balance.coin_value_paise)}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <path
                  d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
