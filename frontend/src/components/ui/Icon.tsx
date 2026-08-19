import styles from "./Icon.module.css";

/**
 * The icon set.
 *
 * Hand-drawn on one spec: 24×24 box, 1.5 stroke, round caps and joins, no
 * fills. Emoji were used here first and they were the wrong call — they
 * render differently on every platform, they carry a cartoon tone a money
 * product should not have, and they cannot inherit weight or colour. These
 * do all three.
 */
export type IconName =
  | "bowl"
  | "ticket"
  | "heart"
  | "parcel"
  | "fuel"
  | "banknote"
  | "coin"
  | "search"
  | "close"
  | "chevron-right"
  | "chevron-down"
  | "arrow-left"
  | "arrow-right"
  | "sun"
  | "moon"
  | "check"
  | "alert"
  | "sparkle";

const PATHS: Record<IconName, React.ReactNode> = {
  bowl: (
    <>
      <path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8Z" />
      <path d="M12 8c0-1.5-1.5-1.8-1.5-3S12 3 12 3" />
      <path d="M16 8c0-1.2-1.2-1.5-1.2-2.5S16 4 16 4" />
      <path d="M2 21h20" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8.5V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M14 6v2M14 11v2M14 16v2" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.8-7 9-7 9Z" />
    </>
  ),
  parcel: (
    <>
      <path d="M21 8.5 12 13 3 8.5 12 4l9 4.5Z" />
      <path d="M3 8.5v7L12 20l9-4.5v-7" />
      <path d="M12 13v7" />
    </>
  ),
  fuel: (
    <>
      <path d="M4 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M3 20h11" />
      <path d="M4 11h9" />
      <path d="M17 8.5 19.5 6c.9.9 1.5 2 1.5 3.4V16a1.75 1.75 0 0 1-3.5 0v-3.5H16" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9.5h6M9 12.5h6M9 15.5h3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </>
  ),
  close: <path d="M5 5l14 14M19 5 5 19" />,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-down": <path d="M5 9l7 7 7-7" />,
  "arrow-left": (
    <>
      <path d="M20 12H4" />
      <path d="M10 6l-6 6 6 6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </>
  ),
  moon: <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5Z" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 7" />,
  alert: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.9 9.3 20 11.2l-6.1 1.9L12 19l-1.9-5.9L4 11.2l6.1-1.9L12 3.5Z" />
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Set when the icon is the only content of a control. */
  label?: string;
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  return (
    <svg
      className={`${styles.icon} ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
