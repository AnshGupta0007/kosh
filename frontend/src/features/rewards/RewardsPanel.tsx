"use client";

import { useState } from "react";

import { Badge, Button, Card, CardHeader, CoinAmount, ErrorState, Skeleton } from "@/components/ui";
import {
  formatDate,
  formatNumber,
  formatRupeesCompact,
  formatRupeesWhole,
} from "@/lib/format";
import { useBalance, useRedemptions, useRewards } from "@/lib/hooks/useApi";
import type { Reward } from "@/lib/types";

import { RedeemModal } from "./RedeemModal";
import styles from "./RewardsPanel.module.css";

/* Each reward carries an accent in the database; this maps it to a hue so
   the card, its icon plate and its glow are all one colour without the
   client hard-coding a palette per reward. */
const ACCENT_HUE: Record<string, number> = {
  coral: 8,
  violet: 265,
  green: 150,
  amber: 42,
  blue: 212,
  teal: 172,
};

const KIND_LABEL: Record<Reward["kind"], string> = {
  VOUCHER: "Voucher",
  CASHBACK: "Cashback",
  DONATION: "Donation",
  UPGRADE: "Upgrade",
};

/**
 * The rewards catalogue and redemption history.
 *
 * Affordability comes from the server, not from arithmetic in the browser —
 * the client showing "redeemable" for something the API will reject is the
 * exact bug this avoids. Locked cards still show progress towards the goal
 * rather than just going grey.
 */
export function RewardsPanel() {
  const [selected, setSelected] = useState<Reward | null>(null);
  const { data: balance } = useBalance();
  const { data: rewards, isPending, isError, error, refetch } = useRewards();
  const { data: history } = useRedemptions();

  return (
    <div className={styles.stack}>
      <Card as="section" aria-labelledby="catalogue-heading">
        <CardHeader
          id="catalogue-heading"
          title="Rewards catalogue"
          subtitle="Coins are worth ₹0.10 each. Earn 1 per ₹100 spent, up to 100 per payment."
          action={
            balance ? (
              <div className={styles.balanceTag}>
                <CoinAmount coins={formatNumber(balance.balance)} size="md" />
                <span className={styles.balanceWorth}>
                  ≈ {formatRupeesWhole(balance.balance * balance.coin_value_paise)}
                </span>
              </div>
            ) : null
          }
        />

        {isError ? (
          <ErrorState
            message={
              error?.code === "NETWORK_ERROR"
                ? "The Kosh API is not reachable."
                : (error?.message ?? "Could not load rewards.")
            }
            onRetry={() => void refetch()}
          />
        ) : (
          <ul className={styles.grid}>
            {isPending
              ? Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className={styles.card}>
                    <Skeleton height="150px" radius="var(--radius-md)" />
                  </li>
                ))
              : rewards?.map((reward) => {
                  const progress = balance
                    ? Math.min(100, (balance.balance / reward.coin_cost) * 100)
                    : 0;
                  const soldOut = reward.stock === 0;

                  const hue = ACCENT_HUE[reward.accent] ?? 42;

                  return (
                    <li
                      key={reward.slug}
                      className={`${styles.card} ${
                        reward.affordable ? styles.available : styles.locked
                      }`}
                      style={{ "--reward-hue": hue } as React.CSSProperties}
                    >
                      <span className={styles.wash} aria-hidden />
                      <div className={styles.cardHead}>
                        <span className={styles.icon} aria-hidden>
                          {reward.icon}
                        </span>
                        <div className={styles.badges}>
                          <Badge tone="neutral">{KIND_LABEL[reward.kind]}</Badge>
                          {soldOut ? (
                            <Badge tone="danger">Sold out</Badge>
                          ) : reward.stock !== null ? (
                            <Badge tone="warning">{reward.stock} left</Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.cardBody}>
                        <h3 className={styles.cardTitle}>{reward.title}</h3>
                        <p className={styles.cardText}>{reward.description}</p>
                      </div>

                      <div className={styles.cardFoot}>
                        <div className={styles.price}>
                          <CoinAmount coins={formatNumber(reward.coin_cost)} size="md" />
                          <span className={styles.worth}>
                            worth {formatRupeesWhole(reward.value_paise)}
                          </span>
                        </div>
                        <Button
                          variant={reward.affordable ? "primary" : "secondary"}
                          size="sm"
                          disabled={!reward.affordable}
                          onClick={() => setSelected(reward)}
                        >
                          {soldOut ? "Sold out" : reward.affordable ? "Redeem" : "Locked"}
                        </Button>
                      </div>

                      {!reward.affordable && !soldOut ? (
                        <div className={styles.progressWrap}>
                          <div className={styles.progressTrack}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className={styles.progressText}>
                            {formatNumber(reward.coins_short)} coins to go — about{" "}
                            {formatRupeesCompact(reward.coins_short * 100 * 100)} more spend
                          </p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
          </ul>
        )}
      </Card>

      <Card as="section" aria-labelledby="history-heading">
        <CardHeader
          id="history-heading"
          title="Redemption history"
          subtitle="Every redemption is a ledger entry — nothing here is a running total"
        />
        {history && history.length > 0 ? (
          <ul className={styles.history}>
            {history.map((entry) => (
              <li key={entry.id} className={styles.historyRow}>
                <span className={styles.historyIcon} aria-hidden>
                  {entry.reward_icon}
                </span>
                <div className={styles.historyMain}>
                  <p className={styles.historyTitle}>{entry.reward_title}</p>
                  <p className={styles.historyMeta}>
                    {formatDate(entry.created_at)} ·{" "}
                    <code className={styles.historyCode}>{entry.voucher_code}</code>
                  </p>
                </div>
                <span className={styles.historyCost}>−{formatNumber(entry.coin_cost)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyHistory}>
            Nothing redeemed yet. Pick something from the catalogue above.
          </p>
        )}
      </Card>

      <RedeemModal reward={selected} balance={balance} onClose={() => setSelected(null)} />
    </div>
  );
}
