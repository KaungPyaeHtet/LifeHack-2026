"use client";

import { band } from "@/lib/dimensions";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ========================================================================
   Primitives
   ===================================================================== */

export const bandColor = (score: number) =>
  ({ green: "var(--accent)", amber: "var(--warn)", red: "var(--bad)" })[
    band(score)
  ];

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts a number up on mount. Every headline figure in this app is the
 * outcome of a measurement, and watching it settle reads as a readout
 * arriving rather than a value that was always there — which is exactly the
 * distinction the project is making.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  // Starts at zero on both server and client, so the first paint matches and
  // the readout always animates in — including when a cached run drops a
  // finished number straight into the tree.
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    // Reduced motion collapses the duration rather than skipping the frame,
    // which keeps the update inside rAF instead of the effect body.
    const span = reduceMotion() ? 0 : duration;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = span <= 0 ? 1 : Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className="num">
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
  }[size];
  const styles = {
    primary:
      "bg-gradient-to-b from-[#7ff0dd] to-[var(--accent)] text-[#03211c] shadow-[0_0_0_1px_var(--accent-dim),0_10px_24px_-14px_var(--accent)] hover:-translate-y-px hover:brightness-110 active:translate-y-0",
    ghost:
      "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]",
    subtle:
      "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]",
  }[variant];
  return (
    <button className={`${base} ${sizes} ${styles}`} {...rest}>
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "good" | "bad" | "warn";
}) {
  const tones = {
    muted: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
    good: "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.08)] text-[var(--accent)]",
    bad: "border-[var(--bad-dim)] bg-[rgb(240_138_138/0.08)] text-[var(--bad)]",
    warn: "border-[var(--warn-dim)] bg-[rgb(245_194_107/0.08)] text-[var(--warn)]",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Selectable chip — the shared control for category, persona and shopper. */
export function Chip({
  active,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        active
          ? "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.1)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

/* ========================================================================
   Layout
   ===================================================================== */

export type StepState = "idle" | "running" | "done";

/**
 * A numbered stage. The badge carries the stage's state so the pipeline's
 * position is legible from any one card on screen — during a demo the
 * audience is usually looking at one card, not the nav.
 */
export function Section({
  id,
  step,
  title,
  subtitle,
  state = "done",
  aside,
  children,
}: {
  id?: string;
  step: number;
  title: string;
  subtitle: string;
  state?: StepState;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card fadeup scroll-mt-24 p-5 sm:p-7">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <StepBadge step={step} state={state} />
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-[var(--muted)]">
              {subtitle}
            </p>
          </div>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

function StepBadge({ step, state }: { step: number; state: StepState }) {
  const style =
    state === "running"
      ? "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.12)] text-[var(--accent)] glowpulse"
      : state === "done"
        ? "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.08)] text-[var(--accent)]"
        : "border-[var(--border)] text-[var(--faint)]";
  return (
    <span
      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold num ${style}`}
    >
      {state === "running" ? <Spinner /> : step}
    </span>
  );
}

/** Headline figure. The one thing a judge should read without scrolling. */
export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  bar,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  bar?: number;
}) {
  const color = {
    neutral: "var(--foreground)",
    good: "var(--accent)",
    warn: "var(--warn)",
    bad: "var(--bad)",
  }[tone];
  return (
    <div className="inset relative overflow-hidden p-4">
      <div className="eyebrow">{label}</div>
      <div
        className="mt-2 text-[27px] font-semibold leading-none tracking-[-0.02em] num"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
          {sub}
        </div>
      )}
      {bar !== undefined && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  tone,
  meta,
  children,
  scroll = true,
}: {
  title: string;
  tone?: "good" | "bad" | "warn";
  meta?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const accent =
    tone === "good"
      ? "var(--accent)"
      : tone === "bad"
        ? "var(--bad)"
        : tone === "warn"
          ? "var(--warn)"
          : "var(--faint)";
  return (
    <div className="inset flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[rgb(255_255_255/0.015)] px-3.5 py-2.5">
        <span className="eyebrow truncate" style={{ color: accent }}>
          {title}
        </span>
        {meta}
      </div>
      <div className={`p-3.5 ${scroll ? "max-h-96 overflow-auto" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export function Callout({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border-l-2 border-[var(--accent-dim)] bg-[rgb(94_234_212/0.04)] py-3 pl-4 pr-4">
      <p className="max-w-[76ch] text-xs leading-relaxed text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">{label} </span>
        {children}
      </p>
    </div>
  );
}

/* ========================================================================
   Data display
   ===================================================================== */

/**
 * One ring, two arcs. Two separate dials left the eye to compute the delta on
 * its own and wasted the column; concentric arcs put before and after in the
 * same glance, with the gain stated outright.
 */
export function DualDial({ before, after }: { before: number; after?: number }) {
  const headline = after ?? before;
  const gain = after !== undefined ? after - before : null;
  const color = bandColor(headline);

  const arc = (r: number, value: number, stroke: string, width: number, dim?: boolean) => {
    const c = 2 * Math.PI * r;
    return (
      <g key={r}>
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="var(--border)" strokeWidth={width}
        />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={stroke} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          opacity={dim ? 0.7 : 1}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
        />
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[148px] w-[148px]">
        <div
          className="absolute inset-6 rounded-full blur-2xl"
          style={{ background: color, opacity: 0.13 }}
        />
        <svg viewBox="0 0 120 120" className="relative h-full w-full -rotate-90">
          {after !== undefined && arc(38, before, "var(--warn)", 7, true)}
          {arc(52, headline, color, 8)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[36px] font-semibold leading-none tracking-[-0.03em] num"
            style={{ color }}
          >
            <CountUp value={headline} />
          </span>
          <span className="eyebrow mt-1">/ 100</span>
          {gain !== null && (
            <span className="mt-1.5 rounded-full border border-[var(--accent-dim)] bg-[rgb(94_234_212/0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] num">
              +{gain}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 w-full max-w-[148px] space-y-1.5 text-[11px]">
        {after !== undefined && (
          <Key color="var(--warn)" label="Original" value={before} />
        )}
        <Key
          color={color}
          label={after !== undefined ? "Agent-ready" : "Readiness"}
          value={headline}
        />
      </div>
    </div>
  );
}

function Key({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-[var(--muted)]">{label}</span>
      <span className="ml-auto num font-medium">{value}</span>
    </div>
  );
}

/**
 * A single track carrying both values: the original runs as a dim base, the
 * improvement continues it in accent. Drawing only the `after` value would
 * leave the delta the numbers claim nowhere on screen.
 */
export function DeltaBar({ before, after }: { before: number; after?: number }) {
  if (after === undefined) {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
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
        className="h-full transition-all duration-1000 ease-out"
        style={{ width: `${base}%`, background: "var(--warn)", opacity: 0.6 }}
      />
      <div
        className="h-full transition-all duration-1000 ease-out"
        style={{
          width: `${change}%`,
          background: shrank ? "var(--bad)" : "var(--accent)",
        }}
      />
    </div>
  );
}

/** Horizontal magnitude bar used inside metric tables. */
export function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Determinate progress track; sweeps while indeterminate work is in flight. */
export function Progress({ value, active }: { value: number; active?: boolean }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--accent-2)] to-[var(--accent)] transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
      {active && <span className="sweep absolute inset-0" />}
    </div>
  );
}
