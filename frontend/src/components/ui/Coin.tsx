import styles from "./Coin.module.css";

/** The coin mark. Inline SVG so it inherits colour and scales with type. */
export function CoinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M6 5.4h4M6 8h4M6 10.6h2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface CoinAmountProps {
  coins: string | number;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
}

/** A coin figure with its mark. Used everywhere a coin count appears. */
export function CoinAmount({ coins, size = "md", muted = false }: CoinAmountProps) {
  return (
    <span className={`${styles.amount} ${styles[size]} ${muted ? styles.muted : ""}`}>
      <CoinIcon size={size === "lg" ? 18 : size === "md" ? 14 : 12} />
      {coins}
    </span>
  );
}
