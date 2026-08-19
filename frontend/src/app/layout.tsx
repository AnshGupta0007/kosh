import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";
import { themeScript } from "@/lib/hooks/useTheme";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Two faces, deliberately.
 *
 * Inter runs the interface — it is a dense data tool and Inter's tabular
 * figures keep a column of rupee amounts aligned to the decimal. Instrument
 * Serif is reserved for the handful of numbers that carry the story: the
 * balance, the KPI values, the amount on a transaction. Nothing else uses it.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint so there is no flash of the
            wrong theme on reload. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${instrumentSerif.variable}`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
