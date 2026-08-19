import type { Theme } from "@/lib/hooks/useTheme";

/**
 * Category colours are derived from the hue stored on each category row, not
 * hard-coded in the client. Seed a new category tomorrow and its chart
 * colour comes with it.
 *
 * Saturation and lightness are fixed per theme so the whole palette sits at
 * one perceived weight — hue is the only thing that varies, which is what
 * keeps a ten-slice donut readable.
 */
export function categoryColor(hue: number, theme: Theme, dimmed = false): string {
  const saturation = theme === "dark" ? 58 : 52;
  const lightness = theme === "dark" ? 62 : 46;
  const alpha = dimmed ? 0.22 : 1;
  return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`;
}
