"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/presets";
import { DIMENSION_MAP, type DimensionKey } from "@/lib/dimensions";
import type { OptimizeResult, Product, QueryBank } from "@/lib/schemas";
import type { Trial } from "@/lib/simulate";
import { toJsonLd, download } from "@/lib/export";
import { Button, Pill, ScoreDial, Section, Spinner, bandColor } from "./components/ui";
import { RadarPanel } from "./components/RadarPanel";
import {
  buildQueryBank, dimMap, optimizeProduct, originalContent,
  scoreProduct, streamSimulation, type Scored, type Summary,
} from "./components/pipeline";
import demoData from "@/lib/demo-data.json";

type Stage = null | "score" | "optimize" | "querybank" | "simulate";

export default function Home() {
  const [product, setProduct] = useState<Product>(CATEGORIES[0].sample);
  const [busy, setBusy] = useState<Stage>(null);
  const [error, setError] = useState<string | null>(null);

  const [score, setScore] = useState<Scored | null>(null);
  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [afterScore, setAfterScore] = useState<Scored | null>(null);
  const [bank, setBank] = useState<QueryBank | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [personaTab, setPersonaTab] = useState(0);

  /**
   * A cached real run of the pipeline. Live LLM latency is the one thing that
   * can sink a timed demo, so the full result is replayable offline — same
   * numbers, no network.
   */
  const loadDemo = () => {
    setError(null);
    setProduct(demoData.product as Product);
    setScore(demoData.score as unknown as Scored);
    setOptimized(demoData.optimized as unknown as OptimizeResult);
    setAfterScore(demoData.afterScore as unknown as Scored);
    setBank(demoData.bank as unknown as QueryBank);
    setTrials(demoData.trials as unknown as Trial[]);
    setSummary(demoData.summary as unknown as Summary);
  };

  const reset = () => {
    setScore(null); setOptimized(null); setAfterScore(null);
    setBank(null); setTrials([]); setSummary(null); setError(null);
  };

  const guard = async (stage: Stage, fn: () => Promise<void>) => {
    setBusy(stage); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const runScore = () =>
    guard("score", async () => {
      reset();
      setScore(await scoreProduct(product));
    });

  const runOptimize = () =>
    guard("optimize", async () => {
      const gaps = score?.dimensions.filter((d) => d.gap).map((d) => d.gap) ?? [];
      const result = await optimizeProduct(product, gaps);
      setOptimized(result);
      // Re-score the rewrite through the identical rubric — the improvement
      // has to survive the same judge, not a friendlier one.
      setAfterScore(
        await scoreProduct({ title: product.title, specs: "", copy: result.optimized }),
      );
    });

  const runSimulation = () =>
    guard("simulate", async () => {
      if (!optimized) return;
      let queryBank = bank;
      if (!queryBank) {
        setBusy("querybank");
        queryBank = await buildQueryBank(product);
        setBank(queryBank);
        setBusy("simulate");
      }
      setTrials([]); setSummary(null);
      const result = await streamSimulation(
        {
          originalContent: originalContent(product),
          optimizedContent: `${product.title}\n\n${optimized.optimized}`,
          queries: queryBank.queries,
          competitors: queryBank.competitors,
        },
        (t) => setTrials((prev) => [...prev, t]),
      );
      setSummary(result);
    });

  const progress = useMemo(
    () => (bank ? Math.round((trials.length / (bank.queries.length * 2)) * 100) : 0),
    [trials.length, bank],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 space-y-5">
      <Header />

      {error && (
        <div className="card border-[#5a2b2b] bg-[#1a0f0f] p-4 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}

      {/* ---------------------------------------------------------- INPUT */}
      <Section
        step={1}
        title="Raw catalogue content"
        subtitle="Paste a listing exactly as it exists today. Any category — nothing downstream is category-specific."
        aside={
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={loadDemo}
              className="rounded-full border border-[var(--accent-dim)] px-2.5 py-1 text-[11px] text-[var(--accent)] hover:brightness-125"
            >
              Load cached run
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => { setProduct(c.sample); reset(); }}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
              >
                {c.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-3">
          <Field label="Product title">
            <input
              value={product.title}
              onChange={(e) => setProduct({ ...product, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Specs / bullets">
              <textarea
                rows={6}
                value={product.specs}
                onChange={(e) => setProduct({ ...product, specs: e.target.value })}
              />
            </Field>
            <Field label="Marketing copy">
              <textarea
                rows={6}
                value={product.copy}
                onChange={(e) => setProduct({ ...product, copy: e.target.value })}
              />
            </Field>
          </div>
          <div>
            <Button onClick={runScore} disabled={busy !== null || !product.title}>
              {busy === "score" ? <><Spinner /> Scoring…</> : "Score readiness"}
            </Button>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- SCORE */}
      {score && (
        <Section
          step={2}
          title="Agent readiness score"
          subtitle={`Inferred category: ${score.category}. Each axis judged by rubric, not keyword match.`}
          aside={
            optimized && afterScore ? (
              <Pill tone="good">
                {score.overall} → {afterScore.overall}
              </Pill>
            ) : undefined
          }
        >
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex gap-6 justify-center">
              <ScoreDial score={score.overall} label="Original" />
              {afterScore && <ScoreDial score={afterScore.overall} label="Optimized" />}
            </div>
            <RadarPanel
              before={dimMap(score)}
              after={afterScore ? dimMap(afterScore) : undefined}
            />
          </div>

          <p className="mt-2 mb-5 text-sm text-[var(--muted)] leading-relaxed">
            {score.summary}
          </p>

          <div className="grid gap-2">
            {score.dimensions.map((d) => {
              const after = afterScore?.dimensions.find((x) => x.key === d.key);
              return (
                <div
                  key={d.key}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {DIMENSION_MAP[d.key as DimensionKey].label}
                    </span>
                    <span className="flex items-baseline gap-2 text-sm tabular-nums">
                      <span style={{ color: bandColor(d.score) }}>{d.score}</span>
                      {after && (
                        <>
                          <span className="text-[var(--muted)]">→</span>
                          <span style={{ color: bandColor(after.score) }}>
                            {after.score}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="h-full rounded transition-all duration-1000"
                      style={{
                        width: `${after?.score ?? d.score}%`,
                        background: bandColor(after?.score ?? d.score),
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{d.reason}</p>
                  {d.gap && !optimized && (
                    <p className="mt-1 text-xs text-[var(--warn)]">Gap: {d.gap}</p>
                  )}
                </div>
              );
            })}
          </div>

          {!optimized && (
            <div className="mt-5">
              <Button onClick={runOptimize} disabled={busy !== null}>
                {busy === "optimize"
                  ? <><Spinner /> Rewriting…</>
                  : "Generate agent-ready content"}
              </Button>
            </div>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------- OPTIMIZE */}
      {optimized && (
        <Section
          step={3}
          title="Agent-ready rewrite"
          subtitle="Same facts, restructured so an agent can cite and reject on them."
          aside={
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                onClick={() =>
                  download(
                    "product.jsonld",
                    JSON.stringify(toJsonLd(product, optimized), null, 2),
                    "application/ld+json",
                  )
                }
              >
                Export JSON-LD
              </Button>
              <Button
                variant="ghost"
                onClick={() => download("listing.md", optimized.optimized, "text/markdown")}
              >
                Export .md
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Before" tone="bad">
              <pre className="whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed text-[var(--muted)]">
                {originalContent(product)}
              </pre>
            </Panel>
            <Panel title="After" tone="good">
              <pre className="whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed">
                {optimized.optimized}
              </pre>
            </Panel>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Panel title={`Structured attributes (${optimized.attributes.length})`}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {optimized.attributes.map((a) => (
                  <div key={a.name} className="contents">
                    <dt className="text-[var(--muted)]">{a.name}</dt>
                    <dd className="tabular-nums">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Needs brand verification">
              <ul className="space-y-1 text-xs text-[var(--warn)]">
                {optimized.assumptions.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                Inferences are surfaced, never silently published — this is what
                makes the rewrite safe for a brand to ship.
              </p>
            </Panel>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {optimized.personas.map((p, i) => (
                <button
                  key={p.persona}
                  onClick={() => setPersonaTab(i)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    personaTab === i
                      ? "border-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {p.persona}
                </button>
              ))}
            </div>
            <Panel title={optimized.personas[personaTab]?.intent ?? "Persona variant"}>
              <pre className="whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed">
                {optimized.personas[personaTab]?.content}
              </pre>
            </Panel>
          </div>

          {!summary && (
            <div className="mt-5">
              <Button onClick={runSimulation} disabled={busy !== null}>
                {busy === "querybank" ? <><Spinner /> Building query bank…</>
                  : busy === "simulate" ? <><Spinner /> Simulating… {progress}%</>
                  : "Run agent simulation"}
              </Button>
            </div>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------- SIMULATE */}
      {(trials.length > 0 || summary) && bank && (
        <Section
          step={4}
          title="Competitive agent simulation"
          subtitle={`${bank.queries.length} shopper queries × ${bank.competitors.length + 1} listings. The agent ranks; we count how often this product is the pick.`}
        >
          {summary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Picked #1"
                  value={`${summary.original.wins} → ${summary.optimized.wins}`}
                  tone={summary.optimized.wins >= summary.original.wins ? "good" : "bad"}
                  sub={`of ${summary.optimized.total} queries`}
                />
                <Stat
                  label="Made top 3"
                  value={`${summary.original.topThree} → ${summary.optimized.topThree}`}
                  tone={summary.optimized.topThree >= summary.original.topThree ? "good" : "bad"}
                  sub="shortlisted by the agent"
                />
                <Stat
                  label="Mean rank"
                  value={`${summary.original.meanRank} → ${summary.optimized.meanRank}`}
                  tone={summary.optimized.meanRank <= summary.original.meanRank ? "good" : "bad"}
                  sub={`of ${bank.competitors.length + 1} listings, lower is better`}
                />
                <Stat
                  label="Queries flipped"
                  value={`${summary.flips.length}`}
                  tone="good"
                  sub="lost before, picked after"
                />
              </div>

              <h3 className="mt-6 mb-2 text-sm font-medium">
                Where the rewrite changed the agent&apos;s mind
              </h3>
              <div className="grid gap-2">
                {summary.flips.map((f) => (
                  <div
                    key={f.query}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                  >
                    <p className="text-sm">&ldquo;{f.query}&rdquo;</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                      <div>
                        <Pill tone="bad">
                          Original — rank {f.original?.rank}/{f.original?.total}
                        </Pill>
                        <p className="mt-1.5 text-[var(--muted)]">
                          {f.original?.reasoning}
                        </p>
                      </div>
                      <div>
                        <Pill tone="good">Optimized — picked</Pill>
                        <p className="mt-1.5 text-[var(--muted)]">
                          {f.optimizedReasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {summary.flips.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">
                    No queries flipped on this run.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div>
              <div className="h-1 w-full overflow-hidden rounded bg-[var(--border)]">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)] tabular-nums">
                {trials.length} / {bank.queries.length * 2} agent decisions
              </p>
            </div>
          )}
        </Section>
      )}
    </main>
  );
}

function Header() {
  return (
    <header className="pt-2 pb-4">
      <h1 className="text-xl font-semibold tracking-tight">
        Agent-Ready Commerce Copilot
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)] leading-relaxed">
        Brands write product content for humans who browse. Shoppers now ask
        agents constrained questions. This scores whether an agent could act on
        a listing, rewrites it so it can, and then proves the difference by
        making both versions compete for the same shoppers.
      </p>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Panel({
  title, tone, children,
}: {
  title: string;
  tone?: "good" | "bad";
  children: React.ReactNode;
}) {
  const accent =
    tone === "good" ? "var(--accent)" : tone === "bad" ? "var(--bad)" : "var(--muted)";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider" style={{ color: accent }}>
        {title}
      </div>
      <div className="max-h-96 overflow-auto">{children}</div>
    </div>
  );
}

function Stat({
  label, value, sub, tone,
}: {
  label: string; value: string; sub: string; tone: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{ color: tone === "good" ? "var(--accent)" : "var(--bad)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{sub}</div>
    </div>
  );
}
