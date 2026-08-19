import type { Metadata } from "next";

import { RewardsPanel } from "@/features/rewards/RewardsPanel";

import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Rewards — Kosh",
  description: "Spend your coins on vouchers, cashback and donations.",
};

export default function RewardsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Coins</p>
        <h1 className={styles.heading}>Rewards</h1>
        <p className={styles.blurb}>
          You earn one coin for every ₹100 of successful spend, up to 100 coins on
          a single payment. Refunds and failed payments earn nothing. Spend them
          here — the balance in the header updates the moment you confirm.
        </p>
      </header>

      <RewardsPanel />
    </div>
  );
}
