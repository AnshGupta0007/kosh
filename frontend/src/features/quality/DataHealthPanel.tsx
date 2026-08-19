"use client";

import { useState } from "react";

import { Badge, Card, CardHeader, ErrorState, Skeleton, Stat } from "@/components/ui";
import { formatNumber, formatPercent, pluralize } from "@/lib/format";
import { useDataQuality } from "@/lib/hooks/useApi";
import type { QualityIssue } from "@/lib/types";

import styles from "./DataHealthPanel.module.css";

const SEVERITY: Record<
  QualityIssue["severity"],
  { tone: "info" | "success" | "danger"; label: string }
> = {
  INFO: { tone: "info", label: "Noted" },
  REPAIRED: { tone: "success", label: "Repaired" },
  QUARANTINED: { tone: "danger", label: "Quarantined" },
};

/**
 * What the loader found in transactions.json, and what it did about it.
 *
 * Every number here is read from the `ingestion_runs` and
 * `data_quality_issues` tables that the seed script writes — nothing is
 * recomputed in the browser. If the seed runs again on a different file, this
 * page changes with it.
 */
export function DataHealthPanel() {
  const { data, isPending, isError, error, refetch } = useDataQuality();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isError) {
    return (
      <Card>
        <ErrorState
          title="Ingestion report unavailable"
          message={
            error?.code === "NETWORK_ERROR"
              ? "The Kosh API is not reachable."
              : (error?.message ?? "No ingestion run has been recorded yet.")
          }
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  const cleanRows = data ? data.rows_loaded - data.rows_repaired : 0;

  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.summary}>
          <Stat
            label="Rows in the file"
            value={data ? formatNumber(data.rows_in) : "—"}
            sub={data ? data.source_file : undefined}
            loading={isPending}
          />
          <Stat
            label="Loaded"
            value={data ? formatNumber(data.rows_loaded) : "—"}
            sub={
              data
                ? data.rows_loaded === data.rows_in
                  ? "Nothing was dropped"
                  : `${formatNumber(data.rows_in - data.rows_loaded)} could not be loaded`
                : undefined
            }
            tone="positive"
            loading={isPending}
          />
          <Stat
            label="Needed repair"
            value={data ? formatNumber(data.rows_repaired) : "—"}
            sub={
              data
                ? `${formatPercent((data.rows_repaired / data.rows_in) * 100, 1)} of the file`
                : undefined
            }
            tone="accent"
            loading={isPending}
          />
          <Stat
            label="Quarantined"
            value={data ? formatNumber(data.rows_quarantined) : "—"}
            sub="Kept, but out of analytics and coins"
            tone={data && data.rows_quarantined > 0 ? "negative" : "default"}
            loading={isPending}
          />
          <Stat
            label="Load time"
            value={data?.duration_ms ? `${formatNumber(data.duration_ms)} ms` : "—"}
            sub="Schema, ETL, insert and ledger"
            loading={isPending}
          />
        </div>

        {data ? (
          <div className={styles.barWrap}>
            <div className={styles.bar} role="img" aria-label={`${formatNumber(cleanRows)} rows clean, ${formatNumber(data.rows_repaired)} repaired, ${formatNumber(data.rows_quarantined)} quarantined`}>
              <span
                className={`${styles.segment} ${styles.clean}`}
                style={{ width: `${(cleanRows / data.rows_in) * 100}%` }}
              />
              <span
                className={`${styles.segment} ${styles.repaired}`}
                style={{ width: `${(data.rows_repaired / data.rows_in) * 100}%` }}
              />
              <span
                className={`${styles.segment} ${styles.quarantined}`}
                style={{
                  width: `${Math.max((data.rows_quarantined / data.rows_in) * 100, 0.4)}%`,
                }}
              />
            </div>
            <ul className={styles.key}>
              <li>
                <span className={`${styles.dot} ${styles.clean}`} aria-hidden />
                {formatNumber(cleanRows)} arrived clean
              </li>
              <li>
                <span className={`${styles.dot} ${styles.repaired}`} aria-hidden />
                {formatNumber(data.rows_repaired)} repaired on import
              </li>
              <li>
                <span className={`${styles.dot} ${styles.quarantined}`} aria-hidden />
                {formatNumber(data.rows_quarantined)} quarantined
              </li>
            </ul>
          </div>
        ) : (
          <Skeleton height="12px" />
        )}
      </Card>

      <Card as="section" aria-labelledby="issues-heading">
        <CardHeader
          id="issues-heading"
          title="Everything we found"
          subtitle="What we found, and what we did about it"
        />

        <ul className={styles.issues}>
          {isPending
            ? Array.from({ length: 5 }, (_, index) => (
                <li key={index}>
                  <Skeleton height="76px" radius="var(--radius-md)" />
                </li>
              ))
            : data?.issues.map((issue) => {
                const open = expanded === issue.code;
                return (
                  <li key={issue.code} className={styles.issue}>
                    <div className={styles.issueHead}>
                      <div className={styles.issueTitle}>
                        <h3 className={styles.issueLabel}>{issue.label}</h3>
                        <Badge tone={SEVERITY[issue.severity].tone}>
                          {SEVERITY[issue.severity].label}
                        </Badge>
                      </div>
                      <span className={styles.issueCount}>
                        {formatNumber(issue.row_count)}
                        <span className={styles.issueCountUnit}>
                          {pluralize(issue.row_count, "row")}
                        </span>
                      </span>
                    </div>

                    <p className={styles.issueDetail}>{issue.detail}</p>
                    <p className={styles.issueResolution}>
                      <span className={styles.arrow} aria-hidden>
                        →
                      </span>
                      {issue.resolution}
                    </p>

                    {issue.samples.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className={styles.toggle}
                          onClick={() => setExpanded(open ? null : issue.code)}
                          aria-expanded={open}
                        >
                          {open ? "Hide" : "Show"} {issue.samples.length} example
                          {issue.samples.length > 1 ? "s" : ""} from the file
                        </button>
                        {open ? (
                          <pre className={styles.samples}>
                            {JSON.stringify(issue.samples, null, 2)}
                          </pre>
                        ) : null}
                      </>
                    ) : null}
                  </li>
                );
              })}
        </ul>
      </Card>
    </div>
  );
}
