import styles from "./States.module.css";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

/** Shown when a filter matches nothing. Always offers a way back out. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <div className={styles.icon} aria-hidden>
        {icon ?? "○"}
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
      {action ? (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Shown when a request fails. Says what broke in plain language and offers
 * a retry — a dead end with a spinner is worse than an honest error.
 */
export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <div className={styles.icon} aria-hidden>
        !
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
