import styles from "./Badge.module.css";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  title?: string;
}

/** Status pill. Colour is never the only signal — the label always says it too. */
export function Badge({ tone = "neutral", dot = false, children, title }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {children}
    </span>
  );
}
