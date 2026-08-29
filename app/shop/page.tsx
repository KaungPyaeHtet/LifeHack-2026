"use client";

import { useState } from "react";
import Link from "next/link";
import { SHOPPERS } from "@/lib/shoppers";
import { ndcgAtK, type RelevanceLabel } from "@/lib/catalog";
import { Button, Pill, Section, Spinner } from "../components/ui";
import catalog from "@/lib/catalog-data.json";
import cached from "@/lib/shop-demo.json";

interface Pick { id: string; reason: string; unmet: string }
interface ShopResult { picks: Pick[]; ranking: string[]; shortlisted: string[]; titles: Record<string, string> }
interface Run {
  labels: Record<string, RelevanceLabel>;
  raw: ShopResult;
  ar: ShopResult;
}

const TITLES = Object.fromEntries(catalog.map((c) => [c.id, c.title]));

export default function Shop() {
  const [shopperId, setShopperId] = useState(SHOPPERS[1].id);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopper = SHOPPERS.find((s) => s.id === shopperId)!;

  const loadCached = () => {
    const hit = cached.find((c) => c.shopperId === shopperId);
    if (!hit) return setError("No cached run for this shopper.");
    setError(null);
    setRun({
      labels: hit.labels as Record<string, RelevanceLabel>,
      raw: { ...hit.raw, ranking: [], titles: TITLES } as ShopResult,
      ar: { ...hit.ar, ranking: [], titles: TITLES } as ShopResult,
    });
  };

  const runLive = async () => {
    setBusy(true); setError(null); setRun(null);
    try {
      const body = { profile: shopper.profile, query: shopper.query };
      const [rel, raw, ar] = await Promise.all([
        fetchJson("/api/relevance", body),
        fetchJson("/api/shop", { ...body, mode: "raw", shortlistSize: 8 }),
        fetchJson("/api/shop", { ...body, mode: "agentReady", shortlistSize: 8 }),
      ]);
      setRun({
        labels: Object.fromEntries(
          rel.labels.map((l: { id: string; label: RelevanceLabel }) => [l.id, l.label]),
        ),
        raw, ar,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 space-y-5">
      <header className="pt-2 pb-4">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← AgentRank
          </Link>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Shopper mode</h1>
        <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-[var(--muted)]">
          The consumer side of the same claim. One shopper, one catalogue of{" "}
          {catalog.length} products, one retrieval engine — run twice. On the
          left the catalogue is written the way brands write today. On the right
          the identical products are agent-ready. The shopper sees three results
          either way; the question is whether they are the right three.
        </p>
      </header>

      {error && (
        <div className="card border-[#5a2b2b] bg-[#1a0f0f] p-4 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}

      <Section
        step={1}
        title="Who is shopping"
        subtitle="Each profile carries at least one hard constraint a listing either answers or does not."
        aside={
          <div className="flex gap-1.5">
            <Button variant="ghost" onClick={loadCached}>Cached</Button>
            <Button onClick={runLive} disabled={busy}>
              {busy ? <><Spinner /> Running…</> : "Run live"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {SHOPPERS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setShopperId(s.id); setRun(null); }}
              className={`rounded-lg border p-3 text-left transition ${
                s.id === shopperId
                  ? "border-[var(--accent-dim)] bg-[var(--surface-2)]"
                  : "border-[var(--border)] hover:border-[var(--muted)]"
              }`}
            >
              <div className="text-sm font-medium">{s.label}</div>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.profile}</p>
              <p className="mt-1.5 text-xs italic text-[var(--foreground)]">
                &ldquo;{s.query}&rdquo;
              </p>
            </button>
          ))}
        </div>
      </Section>

      {run && (
        <Section
          step={2}
          title="What the agent recommends"
          subtitle="Same engine, same shopper, same 30 products. Only the product copy differs."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ResultColumn
              title="Raw catalogue"
              tone="bad"
              result={run.raw}
              labels={run.labels}
            />
            <ResultColumn
              title="Agent-ready catalogue"
              tone="good"
              result={run.ar}
              labels={run.labels}
            />
          </div>
          <Methodology />
        </Section>
      )}

      <Section
        step={3}
        title="Benchmark across all shoppers"
        subtitle="nDCG@3 against ESCI-style labels. Cached from a full run."
      >
        <Aggregate />
      </Section>
    </main>
  );
}

function ResultColumn({
  title, tone, result, labels,
}: {
  title: string;
  tone: "good" | "bad";
  result: ShopResult;
  labels: Record<string, RelevanceLabel>;
}) {
  const score = ndcgAtK(result.picks.map((p) => p.id), labels);
  const accent = tone === "good" ? "var(--accent)" : "var(--warn)";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: accent }}>
          {title}
        </span>
        <span className="text-sm tabular-nums" style={{ color: accent }}>
          nDCG@3 {score.toFixed(3)}
        </span>
      </div>
      <ol className="space-y-2.5">
        {result.picks.map((p, i) => (
          <li key={p.id} className="rounded-md border border-[var(--border)] p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {result.titles[p.id] ?? p.id}
                  </span>
                  <LabelChip label={labels[p.id] ?? "I"} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  {p.reason}
                </p>
                {p.unmet && (
                  <p className="mt-1 text-xs text-[var(--warn)]">
                    Unverifiable: {p.unmet}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const LABEL_META: Record<RelevanceLabel, { text: string; tone: "good" | "bad" | "muted" }> = {
  E: { text: "Exact", tone: "good" },
  S: { text: "Substitute", tone: "muted" },
  C: { text: "Complement", tone: "muted" },
  I: { text: "Irrelevant", tone: "bad" },
};

function LabelChip({ label }: { label: RelevanceLabel }) {
  const m = LABEL_META[label];
  return <Pill tone={m.tone}>{m.text}</Pill>;
}

function Methodology() {
  return (
    <p className="mt-4 max-w-[74ch] text-xs leading-relaxed text-[var(--muted)]">
      <span className="text-[var(--foreground)]">Why this is not self-marking: </span>
      the Exact / Substitute / Complement / Irrelevant labels are graded by a
      separate model from each product&apos;s true specification sheet, which
      the retrieval engine never sees. Ground truth describes what a product{" "}
      <em>is</em>, so rewriting how it is described cannot move the target.
      Grading scheme and metric follow the Amazon Shopping Queries (ESCI)
      dataset and Järvelin &amp; Kekäläinen&apos;s nDCG.
    </p>
  );
}

function Aggregate() {
  const rows = cached.map((c) => ({
    label: SHOPPERS.find((s) => s.id === c.shopperId)?.label ?? c.shopperId,
    raw: c.rawNdcg,
    ar: c.arNdcg,
  }));
  const mean = (f: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + f(r), 0) / rows.length;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="py-2 pr-4 text-left font-medium">Shopper</th>
              <th className="px-3 py-2 text-right font-medium">Raw</th>
              <th className="px-3 py-2 text-right font-medium">Agent-ready</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.ar - r.raw;
              return (
                <tr key={r.label} className="border-b border-[var(--border)]">
                  <td className="py-2.5 pr-4">{r.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--muted)]">
                    {r.raw.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.ar.toFixed(3)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right tabular-nums"
                    style={{ color: d > 0 ? "var(--accent)" : d < 0 ? "var(--bad)" : "var(--muted)" }}
                  >
                    {d > 0 ? "+" : ""}{d.toFixed(3)}
                  </td>
                </tr>
              );
            })}
            <tr className="font-medium">
              <td className="py-2.5 pr-4">Mean</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--muted)]">
                {mean((r) => r.raw).toFixed(3)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--accent)]">
                {mean((r) => r.ar).toFixed(3)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--accent)]">
                +{(mean((r) => r.ar) - mean((r) => r.raw)).toFixed(3)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[74ch] text-xs leading-relaxed text-[var(--muted)]">
        One profile regresses. That is reported rather than dropped: on
        &ldquo;heavier, wide feet&rdquo; the raw catalogue already surfaced a
        correct top three, and the agent-ready rewrite reordered it slightly
        worse. Two profiles sit at or near ceiling because their binding
        constraint is price, which survives even in vague copy — the arms
        separate exactly where the constraint is one raw copy tends to omit.
      </p>
    </>
  );
}

async function fetchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `${url} failed`);
  return data;
}
