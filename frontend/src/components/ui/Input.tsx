"use client";

import { forwardRef, useId } from "react";

import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, iconLeft, onClear, className, id, value, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className={styles.control}>
        {iconLeft ? <span className={styles.icon}>{iconLeft}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={[styles.input, iconLeft ? styles.hasIcon : ""].filter(Boolean).join(" ")}
          aria-describedby={hintId}
          value={value}
          {...rest}
        />
        {onClear && value ? (
          <button type="button" className={styles.clear} onClick={onClear} aria-label="Clear">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
