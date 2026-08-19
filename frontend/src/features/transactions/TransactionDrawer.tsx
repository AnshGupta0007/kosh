"use client";

import { Badge, Button, CoinAmount, Drawer, ErrorState, Skeleton } from "@/components/ui";
import {
  describeFlag,
  formatDateTimeFull,
  formatRupees,
  humanizeMethod,
  humanizeStatus,
} from "@/lib/format";
import { useTransaction } from "@/lib/hooks/useApi";
import type { Transaction, TransactionStatus } from "@/lib/types";

import styles from "./TransactionDrawer.module.css";

const STATUS_TONE: Record<TransactionStatus, "success" | "warning" | "danger"> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
};

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onFilterMerchant: (merchant: string) => void;
  onFilterCategory: (category: string) => void;
}

/**
 * Full detail for one payment.
 *
 * A drawer rather than a modal: the table stays visible behind it, so
 * working down a filtered list row by row does not mean losing your place.
 *
 * The row from the list is shown immediately and the detail request fills in
 * the two fields the list does not carry — there is no spinner over data the
 * client already has.
 */
export function TransactionDrawer({
  transaction,
  onClose,
  onFilterMerchant,
  onFilterCategory,
}: TransactionDrawerProps) {
  const { data: detail, isError, refetch } = useTransaction(transaction?.id ?? null);
  const row = detail ?? transaction;

  return (
    <Drawer
      open={transaction !== null}
      onClose={onClose}
      eyebrow={row ? humanizeMethod(row.method) : undefined}
      title={row?.merchant ?? "Transaction"}
    >
      {!row ? null : (
        <div className={styles.content}>
          <section className={styles.hero}>
            <p className={`${styles.amount} ${row.flow === "REFUND" ? styles.refund : ""}`}>
              {row.flow === "REFUND" ? "+" : ""}
              {formatRupees(Math.abs(row.amount_paise))}
            </p>
            <div className={styles.heroMeta}>
              <Badge tone={STATUS_TONE[row.status]} dot>
                {humanizeStatus(row.status)}
              </Badge>
              {row.flow === "REFUND" ? <Badge tone="info">Refund</Badge> : null}
              {row.is_quarantined ? (
                <Badge tone="danger" title="Excluded from analytics and coin accrual">
                  Quarantined
                </Badge>
              ) : null}
            </div>
            <p className={styles.timestamp}>{formatDateTimeFull(row.occurred_at)} IST</p>
          </section>

          <dl className={styles.facts}>
            <Fact label="Transaction ID" value={<code className={styles.code}>{row.external_id}</code>} />
            <Fact
              label="Category"
              value={
                row.category ? (
                  <button
                    type="button"
                    className={styles.linkish}
                    onClick={() => onFilterCategory(row.category as string)}
                  >
                    {row.category}
                  </button>
                ) : (
                  <span className={styles.muted}>Uncategorised</span>
                )
              }
            />
            <Fact label="Payment method" value={humanizeMethod(row.method)} />
            <Fact
              label="Coins earned"
              value={
                row.coins_earned > 0 ? (
                  <CoinAmount coins={row.coins_earned} size="sm" />
                ) : (
                  <span className={styles.muted}>
                    {row.status === "SUCCESS"
                      ? row.flow === "REFUND"
                        ? "None — refunds do not earn"
                        : "None — under ₹100"
                      : `None — payment ${row.status.toLowerCase()}`}
                  </span>
                )
              }
            />
            <Fact label="Currency" value={row.currency} />
          </dl>

          {row.quality_flags.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                What we fixed on import
                <span className={styles.countPill}>{row.quality_flags.length}</span>
              </h3>
              <ul className={styles.flags}>
                {row.quality_flags.map((flag) => (
                  <li key={flag} className={styles.flag}>
                    <span className={styles.flagDot} aria-hidden />
                    <span>{describeFlag(flag)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Source record</h3>
            <p className={styles.sectionNote}>
              Exactly as it appeared in transactions.json, before normalisation.
            </p>
            {detail ? (
              <pre className={styles.json}>{JSON.stringify(detail.source_row, null, 2)}</pre>
            ) : isError ? (
              <ErrorState
                message="Could not load the source record."
                onRetry={() => void refetch()}
              />
            ) : (
              <Skeleton height="140px" radius="var(--radius-md)" />
            )}
          </section>

          <div className={styles.actions}>
            <Button variant="secondary" fullWidth onClick={() => onFilterMerchant(row.merchant)}>
              Show all {row.merchant} payments
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );
}
