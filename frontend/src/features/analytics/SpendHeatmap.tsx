"use client";

import { useMemo, useRef, useState } from "react";

import { formatNumber, formatRupees } from "@/lib/format";
import type { DayPoint } from "@/lib/types";

import styles from "./SpendHeatmap.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Cell {
  date: string;
  total: number;
  count: number;
  level: number; // 0 = no activity, 1..5 = quintile of spend
}

interface SpendHeatmapProps {
  days: DayPoint[];
  selectedFrom: string;
  selectedTo: string;
  onSelectDay: (date: string) => void;
}

/**
 * Every day of the year, as one picture.
 *
 * The dataset covers 380 days and 10,000 payments, and the table can only
 * ever show fifty of them. This is the one view where the whole thing is on
 * screen at once — and where the shape of a year of spending is legible in
 * a glance rather than inferred from twelve bars.
 *
 * Encoding is sequential, so it follows the sequential rule: a single hue
 * stepped light-to-dark, with the anchor flipped in dark mode (quiet days
 * recede into the surface, heavy days burn bright). It is emphatically not
 * a rainbow — the reader must be able to rank two cells by eye.
 *
 * Levels are quintiles of the *active* days rather than a linear slice of
 * the max. One ₹9.2L outlier day against a ₹1.75L median would otherwise
 * flatten every other day into the bottom bucket.
 *
 * Keyboard: the grid is one tab stop with a roving tabindex, and the arrow
 * keys walk it — 385 individually tabbable cells would be hostile.
 */
export function SpendHeatmap({
  days,
  selectedFrom,
  selectedTo,
  onSelectDay,
}: SpendHeatmapProps) {
  const [hovered, setHovered] = useState<Cell | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const { weeks, monthLabels, thresholds, flat } = useMemo(() => buildCalendar(days), [days]);

  const isSelected = (date: string) =>
    selectedFrom !== "" && selectedFrom === selectedTo && selectedFrom === date;

  const onKeyDown = (event: React.KeyboardEvent) => {
    const columns = weeks.length;
    let next = focusIndex;
    if (event.key === "ArrowRight") next = focusIndex + 7;
    else if (event.key === "ArrowLeft") next = focusIndex - 7;
    else if (event.key === "ArrowDown") next = focusIndex + 1;
    else if (event.key === "ArrowUp") next = focusIndex - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = columns * 7 - 1;
    else return;

    event.preventDefault();
    const clamped = Math.max(0, Math.min(next, columns * 7 - 1));
    setFocusIndex(clamped);
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.focus();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        <div className={styles.calendar}>
          <div className={styles.monthRow} aria-hidden>
            {monthLabels.map((label) => (
              <span
                key={`${label.name}-${label.column}`}
                className={styles.monthLabel}
                style={{ gridColumn: label.column + 1 }}
              >
                {label.name}
              </span>
            ))}
          </div>

          <div className={styles.body}>
            <div className={styles.weekdays} aria-hidden>
              {WEEKDAYS.map((day, index) => (
                <span key={day} className={styles.weekday}>
                  {index % 2 === 0 ? day : ""}
                </span>
              ))}
            </div>

            <div
              ref={gridRef}
              className={styles.grid}
              role="grid"
              aria-label="Daily spend calendar"
              onKeyDown={onKeyDown}
              onMouseLeave={() => setHovered(null)}
            >
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className={styles.week} role="row">
                  {week.map((cell, dayIndex) => {
                    const index = weekIndex * 7 + dayIndex;
                    if (!cell) return <span key={dayIndex} className={styles.blank} />;
                    const selected = isSelected(cell.date);
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        role="gridcell"
                        data-index={index}
                        data-level={cell.level}
                        tabIndex={index === focusIndex ? 0 : -1}
                        className={`${styles.cell} ${selected ? styles.selected : ""}`}
                        // A sweep left-to-right across the year, one week per
                        // 9ms. Capped so a wide range cannot stall the reveal.
                        style={{ animationDelay: `${Math.min(weekIndex * 9, 520)}ms` }}
                        onMouseEnter={() => setHovered(cell)}
                        onFocus={() => {
                          setHovered(cell);
                          setFocusIndex(index);
                        }}
                        onClick={() => onSelectDay(selected ? "" : cell.date)}
                        aria-label={`${cell.date}: ${
                          cell.count === 0
                            ? "no payments"
                            : `${formatRupees(cell.total)} across ${cell.count} payments`
                        }`}
                        aria-selected={selected}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.legendRow}>
        <p className={styles.readout} aria-live="polite">
          {hovered ? (
            <>
              <strong>{formatDayLabel(hovered.date)}</strong>
              {hovered.count === 0 ? (
                <span className={styles.quiet}> — nothing spent</span>
              ) : (
                <>
                  {" — "}
                  <strong className={styles.amount}>{formatRupees(hovered.total)}</strong>
                  <span className={styles.quiet}>
                    {" "}
                    across {formatNumber(hovered.count)} payment
                    {hovered.count === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className={styles.quiet}>
              {formatNumber(flat.length)} days of spending
            </span>
          )}
        </p>

        <div className={styles.legend}>
          <span className={styles.legendLabel}>Less</span>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <span
              key={level}
              className={styles.legendCell}
              data-level={level}
              title={legendTitle(level, thresholds)}
            />
          ))}
          <span className={styles.legendLabel}>More</span>
        </div>
      </footer>
    </div>
  );
}

function legendTitle(level: number, thresholds: number[]): string {
  if (level === 0) return "No payments";
  const low = level === 1 ? 0 : (thresholds[level - 2] ?? 0);
  return `From ${formatRupees(low)}`;
}

function formatDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** Group the day series into Monday-first weeks and compute quintile levels. */
function buildCalendar(days: DayPoint[]) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const flat = days;

  if (days.length === 0) {
    return { weeks: [], monthLabels: [], thresholds: [], flat };
  }

  // Quintiles of the days that actually had spend.
  const active = days
    .map((day) => day.total_paise)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const thresholds = [0.2, 0.4, 0.6, 0.8].map(
    (q) => active[Math.floor(active.length * q)] ?? 0,
  );

  const levelFor = (total: number) => {
    if (total <= 0) return 0;
    let level = 1;
    for (const threshold of thresholds) if (total >= threshold) level += 1;
    return Math.min(level, 5);
  };

  const first = new Date(`${days[0]!.date}T00:00:00Z`);
  const last = new Date(`${days[days.length - 1]!.date}T00:00:00Z`);

  // Back up to the Monday on or before the first day so rows are weekdays.
  const start = new Date(first);
  const offset = (start.getUTCDay() + 6) % 7; // Monday = 0
  start.setUTCDate(start.getUTCDate() - offset);

  const weeks: (Cell | null)[][] = [];
  const monthLabels: { name: string; column: number }[] = [];
  let cursor = new Date(start);
  let lastMonth = -1;

  while (cursor <= last) {
    const week: (Cell | null)[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      if (cursor < first || cursor > last) {
        week.push(null);
      } else {
        const record = byDate.get(iso);
        const total = record?.total_paise ?? 0;
        week.push({
          date: iso,
          total,
          count: record?.transaction_count ?? 0,
          level: levelFor(total),
        });
      }
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Name the column after the month the week *ends* in, so a range that
    // starts mid-week is not labelled with the previous month, and never
    // print two labels within two columns of each other.
    const endMonth = new Date(cursor);
    endMonth.setUTCDate(endMonth.getUTCDate() - 1);
    const month = endMonth.getUTCMonth();
    const lastColumn = monthLabels[monthLabels.length - 1]?.column ?? -99;
    if (month !== lastMonth && weeks.length - lastColumn >= 2) {
      monthLabels.push({ name: MONTHS[month] as string, column: weeks.length });
      lastMonth = month;
    }

    weeks.push(week);
  }

  return { weeks, monthLabels, thresholds, flat };
}
