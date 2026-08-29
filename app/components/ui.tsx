"use client";

import { band } from "@/lib/dimensions";
import type { ReactNode } from "react";

export function Section({
  step,
  title,
  subtitle,
  aside,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-6 fadeup">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[11px] text-[var(--muted)]">
            {step}
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>
          </div>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-[#04150c] hover:brightness-110"
      : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]";
  return (
    <button className={`${base} ${styles}`} {...rest}>
      {children}
    </button>
  );
}

export const bandColor = (score: number) =>
  ({ green: "var(--accent)", amber: "var(--warn)", red: "var(--bad)" })[
    band(score)
  ];

export function ScoreDial({ score, label }: { score: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke="var(--border)" strokeWidth="6"
          />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={bandColor(score)} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - score / 100)}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-2xl font-semibold tabular-nums">{score}</span>
        </div>
      </div>
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "bad" }) {
  const tones = {
    muted: "border-[var(--border)] text-[var(--muted)]",
    good: "border-[var(--accent-dim)] text-[var(--accent)]",
    bad: "border-[#5a2b2b] text-[var(--bad)]",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tones[tone]}`}>
      {children}
    </span>
  );
}
