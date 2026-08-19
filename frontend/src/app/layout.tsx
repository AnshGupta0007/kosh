import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";
import { themeScript } from "@/lib/hooks/useTheme";

import { Providers } from "./providers";
import "./globals.css";

/**
 * One face, five weights.
 *
 * An earlier pass set every figure in a display serif. It read as a
 * newspaper rather than a money product — no modern payments app sets
 * numbers in a serif, and next to it the whole interface looked dated.
 *
 * Plus Jakarta Sans carries both jobs instead: the interface at 400–600,
 * and figures at 700–800 with tight tracking, which is what makes a number
 * read as *a number you should care about* rather than as decorative text.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kosh — pay your card, earn your coins",
  description:
    "A transactions, spend analytics and rewards dashboard over 10,000 real payments. Next.js, FastAPI and PostgreSQL 18.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08080b" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
  ],
};

/**
 * The font variable class goes on <html>, not <body>.
 *
 * tokens.css declares `--font-sans: var(--font-jakarta), …` on :root. A var()
 * that cannot resolve *on the element where the custom property is declared*
 * makes the whole property guaranteed-invalid — so with next/font's class on
 * <body>, --font-sans computed to nothing and every font-family in the app
 * silently fell back to Times.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint so there is no flash of the
            wrong theme on reload. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
