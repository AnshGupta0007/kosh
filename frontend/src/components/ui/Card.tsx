import styles from "./Card.module.css";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}

/** The app's single container surface. Nothing else draws a panel border. */
export function Card({
  padding = "md",
  as: Tag = "div",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[styles.card, styles[`pad-${padding}`], className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}

export function CardHeader({ title, subtitle, action, id }: CardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headings}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </header>
  );
}
