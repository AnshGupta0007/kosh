"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, CoinAmount, Icon, type IconName, Modal, useToast } from "@/components/ui";
import { formatNumber, formatRupeesWhole } from "@/lib/format";
import { useRedeem } from "@/lib/hooks/useApi";
import type { Balance, Reward } from "@/lib/types";

import styles from "./RedeemModal.module.css";

interface RedeemModalProps {
  reward: Reward | null;
  balance?: Balance;
  onClose: () => void;
}

/**
 * Select → confirm → done, in one dialog.
 *
 * Two things this gets right that a naive version does not:
 *
 * 1. The idempotency key is generated once, when the dialog opens, and
 *    reused by every retry. If the first request actually reached the
 *    server and only the response was lost, retrying replays that
 *    redemption instead of buying a second one.
 * 2. A failed redeem never leaves the balance wrong. The optimistic debit
 *    is rolled back by the mutation, the dialog stays open on the confirm
 *    step with the real reason, and the user can try again or walk away.
 */
export function RedeemModal({ reward, balance, onClose }: RedeemModalProps) {
  const redeem = useRedeem();
  const { push } = useToast();
  const [done, setDone] = useState<{ code: string; replayed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  // One key per dialog session, so retries are the same logical request.
  const idempotencyKey = useMemo(
    () => (reward ? `${reward.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : ""),
    [reward],
  );

  useEffect(() => {
    if (reward) {
      setDone(null);
      setCopied(false);
      redeem.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward]);

  if (!reward) return null;

  const balanceAfter = (balance?.balance ?? 0) - reward.coin_cost;

  const confirm = () => {
    redeem.mutate(
      { reward, idempotencyKey },
      {
        onSuccess: (data) => {
          setDone({ code: data.redemption.voucher_code, replayed: data.replayed });
          push({
            tone: "success",
            title: `${reward.title} redeemed`,
            message: `${formatNumber(reward.coin_cost)} coins debited.`,
          });
        },
        onError: (error) => {
          push({
            tone: "error",
            title: "Redemption failed",
            message:
              error.code === "NETWORK_ERROR"
                ? "We could not reach the server. Your coins have not been touched."
                : error.message,
          });
        },
      },
    );
  };

  const copyCode = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission). The code
      // is on screen and selectable, so this is a non-event.
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={redeem.isPending}
      title={done ? "Redeemed" : "Confirm redemption"}
      description={
        done
          ? undefined
          : `${reward.title} costs ${formatNumber(reward.coin_cost)} coins.`
      }
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={redeem.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirm}
              loading={redeem.isPending}
              disabled={!reward.affordable}
            >
              {redeem.isError ? "Try again" : "Confirm redemption"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className={styles.success}>
          <div className={styles.tick} aria-hidden>
            <svg width="26" height="26" viewBox="0 0 26 26">
              <path
                d="M6 13.5l4.6 4.6L20 8.6"
                stroke="currentColor"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className={styles.successTitle}>{reward.title}</p>
          <p className={styles.successNote}>
            {done.replayed
              ? "This redemption had already gone through, so we returned the original voucher rather than charging you twice."
              : "Your voucher is ready. We have emailed a copy too."}
          </p>

          <div className={styles.voucher}>
            <span className={styles.voucherLabel}>Voucher code</span>
            <code className={styles.voucherCode}>{done.code}</code>
            <Button size="sm" variant="secondary" onClick={() => void copyCode()}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.confirm}>
          <div className={styles.rewardRow}>
            <span className={styles.icon}>
              <Icon name={reward.icon as IconName} size={24} />
            </span>
            <div>
              <p className={styles.rewardTitle}>{reward.title}</p>
              <p className={styles.rewardWorth}>
                Worth {formatRupeesWhole(reward.value_paise)}
              </p>
            </div>
          </div>

          <dl className={styles.ledger}>
            <div className={styles.ledgerRow}>
              <dt>Balance now</dt>
              <dd>
                <CoinAmount coins={formatNumber(balance?.balance ?? 0)} size="sm" muted />
              </dd>
            </div>
            <div className={styles.ledgerRow}>
              <dt>This redemption</dt>
              <dd className={styles.debit}>−{formatNumber(reward.coin_cost)}</dd>
            </div>
            <div className={`${styles.ledgerRow} ${styles.ledgerTotal}`}>
              <dt>Balance after</dt>
              <dd>
                <CoinAmount coins={formatNumber(Math.max(0, balanceAfter))} size="sm" />
              </dd>
            </div>
          </dl>

          {redeem.isError ? (
            <p className={styles.error} role="alert">
              <strong>Could not redeem.</strong>{" "}
              {redeem.error.code === "NETWORK_ERROR"
                ? "We could not reach the server. Nothing was charged — your balance is unchanged."
                : redeem.error.message}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
