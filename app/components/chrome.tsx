"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The wordmark, drawn rather than typed: three bars, the last one winning. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0d0f15" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="var(--border)" />
      <rect x="7" y="17" width="4" height="8" rx="1.5" fill="var(--warn)" />
      <rect x="14" y="12" width="4" height="13" rx="1.5" fill="var(--accent)" opacity="0.5" />
      <rect x="21" y="6" width="4" height="19" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Brand pipeline", hint: "Score → rewrite → prove" },
  { href: "/shop", label: "Shopper mode", hint: "Catalogue benchmark" },
];

/**
 * One persistent bar across both views. During a demo the two modes get
 * switched between repeatedly, so the switch has to be visible at all times
 * rather than a link buried in a page header.
 */
export function NavBar({ status }: { status?: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgb(6_7_10/0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Mark />
          {/* The wordmark is the first thing to go on a narrow screen — the
              mark still identifies the app, and the mode switch must not wrap. */}
          <span className="hidden text-[15px] font-semibold tracking-[-0.01em] sm:inline">
            AgentRank
          </span>
        </Link>

        <nav className="ml-1 flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 sm:ml-2">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                title={t.hint}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--surface-3)] text-[var(--foreground)] shadow-[0_0_0_1px_var(--border-strong)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">{status}</div>
      </div>
    </div>
  );
}

/** Live/cached indicator. Says plainly which numbers are on screen. */
export function SourceBadge({ mode }: { mode: "live" | "cached" | "idle" }) {
  if (mode === "idle") return null;
  const live = mode === "live";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        live
          ? "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.08)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "pulsedot" : ""}`}
        style={{ background: live ? "var(--accent)" : "var(--faint)" }}
      />
      <span className="hidden sm:inline">
        {live ? "Live model run" : "Cached run"}
      </span>
      <span className="sm:hidden">{live ? "Live" : "Cached"}</span>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] pt-6 pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 text-[11px] text-[var(--faint)] sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Mark size={18} />
          <span>AgentRank — LifeHack NUS 2026, Rezolve AI track</span>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Next.js 16 · AI SDK v7 · Zod · Recharts</span>
          <span className="hidden sm:inline text-[var(--border-strong)]">|</span>
          <span>Metrics: MRR, Recall@3, nDCG@3 (ESCI grading)</span>
        </div>
      </div>
    </footer>
  );
}
