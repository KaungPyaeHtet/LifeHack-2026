"use client";

import { useCallback, useEffect, useState } from "react";
import { SHOPPERS } from "@/lib/shoppers";
import { ndcgAtK, type RelevanceLabel } from "@/lib/catalog";
import {
  Button, Callout, CountUp, Panel, Pill, Progress, Section, Spinner, Stat,
} from "../components/ui";
import { Footer, NavBar, SourceBadge } from "../components/chrome";
import catalog from "@/lib/catalog-data.json";
import cached from "@/lib/shop-demo.json";

interface Pick { id: string; reason: string; unmet: string }
interface ShopResult {
  picks: Pick[];
  ranking: string[];
  shortlisted: string[];
  titles: Record<string, string>;
}
interface Run {
  labels: Record<string, RelevanceLabel>;
  raw: ShopResult;
  ar: ShopResult;
}

const TITLES = Object.fromEntries(catalog.map((c) => [c.id, c.title]));

export default function Shop() {
  const [shopperId, setShopperId] = useState(SHOPPERS[1].id);
  const [run, setRun] = useState<Run | null>(null);
  const [source, setSource] = useState<"idle" | "live" | "cached">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopper = SHOPPERS.find((s) => s.id === shopperId)!;

  /**
   * Replays a recorded run of the selected profile. Bound to a key rather than
   * a button: live model latency can sink a timed presentation, but the
   * fallback is presenter machinery and does not belong in the interface.
   */
  const loadCached = useCallback(() => {
    const hit = cached.find((c) => c.shopperId === shopperId);
    if (!hit) return setError("No recorded run for this shopper.");
    setError(null);
    setSource("cached");
    setRun({
      labels: hit.labels as Record<string, RelevanceLabel>,
      raw: { ...hit.raw, ranking: [], titles: TITLES } as ShopResult,
      ar: { ...hit.ar, ranking: [], titles: TITLES } as ShopResult,
    });
  }, [shopperId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") loadCached();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadCached]);

  const runLive = async () => {
    setBusy(true); setError(null); setRun(null); setSource("live");
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
      setSource("idle");
    } finally {
      setBusy(false);
    }
  };

  const rawNdcg = run ? ndcgAtK(run.raw.picks.map((p) => p.id), run.labels) : 0;
  const arNdcg = run ? ndcgAtK(run.ar.picks.map((p) => p.id), run.labels) : 0;

  return (
    <>
      <NavBar status={<SourceBadge mode={source} />} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16">
        <header className="fadeup py-10 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="good">Shopper mode</Pill>
            <Pill>{catalog.length}-SKU catalogue · two-stage retrieval</Pill>
          </div>
          <h1 className="mt-5 max-w-[22ch] text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
            Same engine, same shopper.{" "}
            <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
              Only the copy differs.
            </span>
          </h1>
          <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-[var(--muted)]">
            The consumer side of the same claim, and the platform&apos;s ROI rather
            than one brand&apos;s. One catalogue of {catalog.length} products runs
            twice through one retrieval engine — on the left written the way brands
            write today, on the right agent-ready. The shopper sees three results
            either way; the question is whether they are the{" "}
            <span className="text-[var(--foreground)]">right</span> three.
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <Rail n={1} label="Embed" note="shortlist 8 of 30" />
            <Rail n={2} label="Rerank" note="LLM picks the top 3" />
            <Rail n={3} label="Grade" note="nDCG@3 vs ESCI labels" />
          </div>
        </header>

        {error && (
          <div className="card fadeup mb-5 border-[var(--bad-dim)] bg-[rgb(240_138_138/0.06)] p-4 text-sm text-[var(--bad)]">
            <span className="font-medium">Run failed. </span>{error}
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Check that a model key is set in <span className="mono">.env.local</span>.
            </span>
          </div>
        )}

        {run && (
          <div className="card fadeup mb-5 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-2">
              <h2 className="text-sm font-semibold">
                {shopper.label} — measured outcome
              </h2>
              <span className="text-xs text-[var(--muted)]">
                nDCG@3 against labels graded from hidden spec sheets
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Raw catalogue"
                tone="warn"
                bar={rawNdcg * 100}
                value={<CountUp value={rawNdcg} decimals={3} />}
                sub="copy as brands write it today"
              />
              <Stat
                label="Agent-ready catalogue"
                tone="good"
                bar={arNdcg * 100}
                value={<CountUp value={arNdcg} decimals={3} />}
                sub="identical products, restructured"
              />
              <Stat
                label="Difference"
                tone={arNdcg >= rawNdcg ? "good" : "bad"}
                bar={Math.abs(arNdcg - rawNdcg) * 100}
                value={
                  <CountUp
                    value={arNdcg - rawNdcg}
                    decimals={3}
                    prefix={arNdcg - rawNdcg >= 0 ? "+" : ""}
                  />
                }
                sub={
                  rawNdcg === 1
                    ? "raw already at ceiling on this profile"
                    : arNdcg >= rawNdcg
                      ? "ranking quality gained"
                      : "reported, not dropped"
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-5">
          <Section
            step={1}
            state="done"
            title="Who is shopping"
            subtitle="Each profile carries at least one hard constraint a listing either answers or does not — soft preference-only profiles cannot separate the arms."
            aside={
              <Button onClick={runLive} disabled={busy}>
                {busy ? <><Spinner /> Running…</> : "Run retrieval"}
              </Button>
            }
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SHOPPERS.map((s) => {
                const active = s.id === shopperId;
                const row = cached.find((c) => c.shopperId === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setShopperId(s.id); setRun(null); setSource("idle"); }}
                    className={`inset p-3.5 text-left transition ${
                      active
                        ? "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.05)]"
                        : "hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: active ? "var(--accent)" : "var(--foreground)" }}
                      >
                        {s.label}
                      </span>
                      {row && (
                        <span className="num text-[11px] text-[var(--faint)]">
                          {row.rawNdcg.toFixed(2)} → {row.arNdcg.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                      {s.profile}
                    </p>
                    <p className="mt-2 border-l-2 border-[var(--border-strong)] pl-2.5 text-xs italic leading-relaxed">
                      &ldquo;{s.query}&rdquo;
                    </p>
                  </button>
                );
              })}
            </div>

            {busy && (
              <div className="mt-4">
                <Progress value={60} active />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Embedding the query, shortlisting 8 of {catalog.length}, reranking
                  both arms, and grading relevance from the hidden spec sheets — three
                  calls in parallel.
                </p>
              </div>
            )}
          </Section>

          {run && (
            <Section
              step={2}
              state="done"
              title="What the agent recommends"
              subtitle={`Same engine, same shopper, same ${catalog.length} products. Only the product copy differs between the two columns.`}
            >
              <div className="grid gap-3 lg:grid-cols-2">
                <ResultColumn
                  title="Raw catalogue"
                  tone="bad"
                  result={run.raw}
                  labels={run.labels}
                  score={rawNdcg}
                />
                <ResultColumn
                  title="Agent-ready catalogue"
                  tone="good"
                  result={run.ar}
                  labels={run.labels}
                  score={arNdcg}
                />
              </div>
              <Callout label="Why this is not self-marking:">
                the Exact / Substitute / Complement / Irrelevant labels are graded by
                a separate model from each product&apos;s true specification sheet,
                which the retrieval engine never sees. Ground truth describes what a
                product <em>is</em>, so rewriting how it is described cannot move the
                target. Grading scheme and metric follow the Amazon Shopping Queries
                (ESCI) dataset and Järvelin &amp; Kekäläinen&apos;s nDCG.
              </Callout>
            </Section>
          )}

          <Section
            step={3}
            state="done"
            title="Benchmark across all shoppers"
            subtitle="nDCG@3 against ESCI-style graded labels, cached from a full run of all four profiles."
            aside={<Pill>4 profiles · {catalog.length} SKUs</Pill>}
          >
            <Aggregate />
          </Section>
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ===================================================================== */

function Rail({ n, label, note }: { n: number; label: string; note: string }) {
  return (
    <div className="inset flex items-center gap-3 p-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--accent-dim)] bg-[rgb(94_234_212/0.1)] text-[11px] font-semibold num text-[var(--accent)]">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="truncate text-[11px] text-[var(--faint)]">{note}</div>
      </div>
    </div>
  );
}

function ResultColumn({
  title, tone, result, labels, score,
}: {
  title: string;
  tone: "good" | "bad";
  result: ShopResult;
  labels: Record<string, RelevanceLabel>;
  score: number;
}) {
  const accent = tone === "good" ? "var(--accent)" : "var(--warn)";

  return (
    <Panel
      title={title}
      tone={tone === "good" ? "good" : "warn"}
      scroll={false}
      meta={
        <span className="num text-[12px] font-semibold" style={{ color: accent }}>
          nDCG@3 {score.toFixed(3)}
        </span>
      }
    >
      <ol className="space-y-2.5">
        {result.picks.map((p, i) => (
          <li
            key={p.id}
            className="rounded-md border border-[var(--border)] bg-[rgb(255_255_255/0.012)] p-3"
          >
            <div className="flex items-start gap-2.5">
              <span
                className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded num text-[11px] font-semibold"
                style={{
                  color: i === 0 ? "#03211c" : "var(--muted)",
                  background: i === 0 ? accent : "var(--surface-3)",
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-medium">
                    {result.titles[p.id] ?? p.id}
                  </span>
                  <LabelChip label={labels[p.id] ?? "I"} />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                  {p.reason}
                </p>
                {p.unmet && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--warn)]">
                    <span className="eyebrow text-[var(--warn)]">Unverifiable </span>
                    {p.unmet}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const LABEL_META: Record<
  RelevanceLabel,
  { text: string; tone: "good" | "bad" | "muted" | "warn" }
> = {
  E: { text: "Exact", tone: "good" },
  S: { text: "Substitute", tone: "muted" },
  C: { text: "Complement", tone: "warn" },
  I: { text: "Irrelevant", tone: "bad" },
};

function LabelChip({ label }: { label: RelevanceLabel }) {
  const m = LABEL_META[label];
  return <Pill tone={m.tone}>{m.text}</Pill>;
}

/**
 * Paired bars rather than a table alone. The story here is that two profiles
 * sit at ceiling and one regresses — a shape the eye reads instantly and a
 * column of numbers does not.
 */
function Aggregate() {
  const rows = cached.map((c) => ({
    label: SHOPPERS.find((s) => s.id === c.shopperId)?.label ?? c.shopperId,
    raw: c.rawNdcg,
    ar: c.arNdcg,
  }));
  const mean = (f: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const meanRaw = mean((r) => r.raw);
  const meanAr = mean((r) => r.ar);

  return (
    <>
      <div className="space-y-3.5">
        {rows.map((r) => {
          const d = r.ar - r.raw;
          return (
            <div key={r.label} className="grid gap-2 sm:grid-cols-[180px_1fr_84px] sm:items-center">
              <div className="text-[13px] font-medium">{r.label}</div>
              <div className="space-y-1">
                <BarRow value={r.raw} color="var(--warn)" tag="Raw" />
                <BarRow value={r.ar} color="var(--accent)" tag="Agent-ready" />
              </div>
              <div
                className="num text-right text-[13px] font-semibold"
                style={{
                  color: d > 0.001 ? "var(--accent)" : d < -0.001 ? "var(--bad)" : "var(--faint)",
                }}
              >
                {Math.abs(d) < 0.001 ? "ceiling" : `${d > 0 ? "+" : ""}${d.toFixed(3)}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4">
        <span className="eyebrow">Mean nDCG@3</span>
        <span className="num text-sm text-[var(--warn)]">
          raw {meanRaw.toFixed(3)}
        </span>
        <span className="text-[var(--faint)]">→</span>
        <span className="num text-sm font-semibold text-[var(--accent)]">
          agent-ready {meanAr.toFixed(3)}
        </span>
        <span className="num rounded-full border border-[var(--accent-dim)] bg-[rgb(94_234_212/0.08)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
          +{(meanAr - meanRaw).toFixed(3)}
        </span>
      </div>

      <Callout label="One profile regresses, and it is reported rather than dropped.">
        On &ldquo;heavier, wide feet&rdquo; the raw catalogue already surfaced a
        correct top three and the rewrite reordered it slightly worse. Two profiles
        sit at ceiling because their binding constraint is price, which survives
        even in vague copy — the arms separate exactly where the constraint is one
        raw copy tends to omit (breathability, terrain, fit). A benchmark you always
        win is not a benchmark.
      </Callout>
    </>
  );
}

function BarRow({ value, color, tag }: { value: number; color: string; tag: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[76px] shrink-0 text-[10px] text-[var(--faint)]">{tag}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="w-[42px] shrink-0 num text-right text-[11px] text-[var(--muted)]">
        {value.toFixed(3)}
      </span>
    </div>
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
