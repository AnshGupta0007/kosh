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
          The supplied <code>transactions.json</code> is not clean — five different
          timestamp encodings, amounts as strings, blank categories, reused ids and
          one payment of ₹99,99,99,999. Rather than quietly patching it and moving
          on, the loader records every repair it makes. This page reads that record
          back out of the database.
        </p>
      </header>

      <DataHealthPanel />
    </div>
  );
}
