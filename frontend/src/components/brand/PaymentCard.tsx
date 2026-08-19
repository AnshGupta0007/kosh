"use client";

import { CoinIcon } from "@/components/ui";
import { formatNumber, formatRupeesWhole } from "@/lib/format";

import styles from "./PaymentCard.module.css";

interface PaymentCardProps {
  holder: string;
  last4: string;
  coins: number;
  coinValuePaise: number;
  loading?: boolean;
}

/**
 * The Kosh card.
 *
 * This app is about paying a credit-card bill, and until this existed the
 * product had no object at its centre — just charts about an abstraction.
 * Rendering the card gives the whole dashboard something to be *about*, and
 * it is the right home for the coin balance: on the card, where a real
 * rewards programme puts it.
 *
 * Drawn entirely in CSS. No image, so it stays sharp at any size, re-themes
 * with the tokens and costs nothing to load. The sheen sweep is a single
 * gradient moved on hover.
 */
export function PaymentCard({
  holder,
  last4,
  coins,
  coinValuePaise,
  loading = false,
}: PaymentCardProps) {
  return (
    <div className={styles.card} aria-label={`Kosh card ending ${last4}`}>
      <span className={styles.sheen} aria-hidden />

      <header className={styles.head}>
        <span className={styles.brand}>Kosh</span>
        <span className={styles.network} aria-hidden>
          <span className={styles.ring} />
          <span className={styles.ring} />
        </span>
      </header>

      {/* The EMV chip, drawn with a grid rather than an image. */}
      <span className={styles.chip} aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </span>

      <p className={styles.number}>
        <span className={styles.dots}>••••</span>
        <span className={styles.dots}>••••</span>
        <span className={styles.dots}>••••</span>
        <span className={styles.last4}>{last4}</span>
      </p>

      <footer className={styles.foot}>
        <div className={styles.holder}>
          <span className={styles.microLabel}>Card holder</span>
          <span className={styles.holderName}>{holder}</span>
        </div>

        <div className={styles.balance}>
          <span className={styles.microLabel}>Coin balance</span>
          <span className={styles.coins}>
            <CoinIcon size={16} />
            {loading ? "—" : formatNumber(coins)}
          </span>
          <span className={styles.worth}>
            {loading ? "" : `≈ ${formatRupeesWhole(coins * coinValuePaise)}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
