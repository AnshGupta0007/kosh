import type { Metadata } from "next";

import { DataHealthPanel } from "@/features/quality/DataHealthPanel";

import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Data health — Kosh",
  description: "What we found in the source dataset and what we did about it.",
};

export default function DataHealthPage() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Ingestion</p>
        <h1 className={styles.heading}>Data health</h1>
        <p className={styles.blurb}>
          The file behind this app arrived messy — five ways of writing a date,
          amounts as text, blank categories, one payment of ₹99,99,99,999. We
          repaired what we could and kept a record of all of it.
        </p>
      </header>

      <DataHealthPanel />
    </div>
  );
}
