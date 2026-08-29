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

/**
 * One ring, two arcs. Two separate dials left the eye to compute the delta on
 * its own and wasted the column; concentric arcs put before and after in the
 * same glance, with the gain stated outright.
 */
export function DualDial({ before, after }: { before: number; after?: number }) {
  const arc = (r: number, value: number, color: string, width: number) => {
    const c = 2 * Math.PI * r;
    return (
      <>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth={width} />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)" }}
        />
      </>
    );
  };

  const headline = after ?? before;
  const gain = after !== undefined ? after - before : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[132px] w-[132px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {after !== undefined && arc(38, before, "var(--warn)", 7)}
          {arc(52, headline, bandColor(headline), 8)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[32px] font-semibold leading-none tabular-nums">
            {headline}
          </span>
          {gain !== null && (
            <span className="mt-1 text-xs font-medium tabular-nums text-[var(--accent)]">
              +{gain}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        {after !== undefined && (
          <Key color="var(--warn)" label="Original" value={before} />
        )}
        <Key
          color={bandColor(headline)}
          label={after !== undefined ? "Optimized" : "Readiness"}
          value={headline}
        />
      </div>
    </div>
  );
}

function Key({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[var(--muted)]">{label}</span>
      <span className="ml-auto tabular-nums">{value}</span>
    </div>
  );
}

/**
 * A single track carrying both values: the original runs as a dim base, the
 * improvement continues it in accent. The old version drew only the `after`
 * value, so the delta the numbers claimed was nowhere on screen.
 */
export function DeltaBar({ before, after }: { before: number; after?: number }) {
  if (after === undefined) {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${before}%`, background: bandColor(before) }}
        />
      </div>
    );
  }

  const shrank = after < before;
  const base = Math.min(before, after);
  const change = Math.abs(after - before);

  return (
    <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full transition-all duration-1000"
        style={{ width: `${base}%`, background: "var(--warn)", opacity: 0.55 }}
      />
      <div
        className="h-full transition-all duration-1000"
        style={{
          width: `${change}%`,
          background: shrank ? "var(--bad)" : "var(--accent)",
        }}
      />
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
