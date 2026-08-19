import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}

/**
 * Loading placeholder.
 *
 * Sized to match the content it stands in for, so the layout does not jump
 * when real data arrives. The shimmer is suppressed under
 * prefers-reduced-motion by the global rule in globals.css.
 */
export function Skeleton({ width = "100%", height = "1em", radius, className }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className ?? ""}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}
