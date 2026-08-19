import { Skeleton } from "./Skeleton";
import styles from "./Stat.module.css";

interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "accent" | "positive" | "negative";
  loading?: boolean;
  /** Sparkline, badge or anything else that sits to the right of the value. */
  aside?: React.ReactNode;
}

/**
 * A single figure with its label.
 *
 * The value uses the display serif at a large size — in a dense grey table
 * UI, the numbers that matter should not look like more table.
 */
export function Stat({ label, value, sub, tone = "default", loading, aside }: StatProps) {
  return (
    <div className={`${styles.stat} ${styles[tone]}`}>
      <p className={styles.label}>{label}</p>
      {loading ? (
        <Skeleton width="70%" height="1.9rem" />
      ) : (
        <div className={styles.valueRow}>
          <p className={styles.value}>{value}</p>
          {aside}
        </div>
      )}
      {sub && !loading ? <p className={styles.sub}>{sub}</p> : null}
    </div>
  );
}
