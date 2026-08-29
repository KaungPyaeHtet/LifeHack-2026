"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/presets";
import { DIMENSION_MAP, type DimensionKey } from "@/lib/dimensions";
import type { OptimizeResult, Product, QueryBank } from "@/lib/schemas";
import type { Trial } from "@/lib/simulate";
import { toJsonLd, download } from "@/lib/export";
import {
  bandColor, Button, DeltaBar, DualDial, Pill, Section, Spinner,
} from "./components/ui";
import { RadarPanel } from "./components/RadarPanel";
import {
  bloatProduct, buildQueryBank, dimMap, optimizeProduct, originalContent,
  scoreProduct, streamSimulation, type Arm, type ArmStat, type Scored, type Summary,
} from "./components/pipeline";
import demoData from "@/lib/demo-data.json";

type Stage = null | "score" | "optimize" | "querybank" | "bloat" | "simulate";

const wordsIn = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

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
  const [arms, setArms] = useState<Arm[]>([]);
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
    setArms(demoData.arms as unknown as Arm[]);
  };

  const reset = () => {
    setScore(null); setOptimized(null); setAfterScore(null);
    setBank(null); setTrials([]); setSummary(null); setArms([]); setError(null);
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
      }

      // Arm B exists so the headline number survives the obvious challenge:
      // LLM judges favour longer text, and the rewrite IS longer. Padding the
      // original to a matched length with no new facts separates the two.
      setBusy("bloat");
      const raw = originalContent(product);
      const optimizedFull = `${product.title}\n\n${optimized.optimized}`;
      const { bloated } = await bloatProduct(
        product,
        Math.round(wordsIn(optimizedFull)),
      );

      const armSet: Arm[] = [
        { id: "raw", label: "Raw catalogue", content: raw },
        { id: "bloat", label: "Bloat control", content: `${product.title}\n\n${bloated}` },
        { id: "optimized", label: "AgentRank", content: optimizedFull },
      ];
      setArms(armSet);

      setBusy("simulate");
      setTrials([]); setSummary(null);
      const result = await streamSimulation(
        { arms: armSet, queries: queryBank.queries, competitors: queryBank.competitors },
        (t) => setTrials((prev) => [...prev, t]),
      );
      setSummary(result);
    });

  const progress = useMemo(
    () =>
      bank && arms.length
        ? Math.round((trials.length / (bank.queries.length * arms.length)) * 100)
        : 0,
    [trials.length, bank, arms.length],
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
        >
          <div className="grid items-center gap-8 md:grid-cols-[168px_1fr]">
            <DualDial
              before={score.overall}
              after={afterScore?.overall}
            />
            <RadarPanel
              before={dimMap(score)}
              after={afterScore ? dimMap(afterScore) : undefined}
            />
          </div>

          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-[var(--muted)]">
            {score.summary}
          </p>

          <div className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {score.dimensions.map((d) => {
              const after = afterScore?.dimensions.find((x) => x.key === d.key);
              const dim = DIMENSION_MAP[d.key as DimensionKey];
              return (
                <div
                  key={d.key}
                  className="grid items-start gap-x-8 gap-y-2 py-4 sm:grid-cols-[1fr_200px]"
                >
                  <div className="max-w-[62ch]">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-sm font-medium">{dim.label}</h4>
                      <span className="text-[11px] text-[var(--muted)]">
                        weight {dim.weight.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      {d.reason}
                    </p>
                    {d.gap && !optimized && (
                      <p className="mt-1 text-xs text-[var(--warn)]">Gap: {d.gap}</p>
                    )}
                  </div>

                  <div className="sm:pt-0.5">
                    <div className="mb-1.5 flex items-baseline gap-1.5 text-sm tabular-nums">
                      <span
                        style={{ color: after ? "var(--warn)" : bandColor(d.score) }}
                      >
                        {d.score}
                      </span>
                      {after && (
                        <>
                          <span className="text-[var(--muted)]">→</span>
                          <span style={{ color: bandColor(after.score) }}>
                            {after.score}
                          </span>
                          <span className="ml-auto text-xs text-[var(--accent)]">
                            {after.score - d.score >= 0 ? "+" : ""}
                            {after.score - d.score}
                          </span>
                        </>
                      )}
                    </div>
                    <DeltaBar before={d.score} after={after?.score} />
                  </div>
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
                  : busy === "bloat" ? <><Spinner /> Building control arm…</>
                  : busy === "simulate" ? <><Spinner /> Simulating… {progress}%</>
                  : "Run 3-arm ablation"}
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
              <ArmTable stats={summary.stats} />
              <VerdictNote stats={summary.stats} />

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
                {trials.length} / {bank.queries.length * (arms.length || 3)} agent decisions
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
      <div className="flex items-baseline gap-2.5">
        <h1 className="text-xl font-semibold tracking-tight">AgentRank</h1>
        <span className="text-sm text-[var(--muted)]">
          agent readiness for product content
        </span>
        <Link
          href="/shop"
          className="ml-auto rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Shopper mode →
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] leading-relaxed">
        Your product ranks #1 on Google. Where does it rank with an agent?
        Brands write content for humans who browse, but shoppers now ask agents
        constrained questions. AgentRank scores whether an agent could act on a
        listing, rewrites it so it can, then proves the difference by making
        both versions compete for the same shoppers.
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

function ArmTable({ stats }: { stats: ArmStat[] }) {
  const best = (pick: (s: ArmStat) => number, lower = false) =>
    stats.reduce((a, b) => (lower ? (pick(b) < pick(a) ? b : a) : pick(b) > pick(a) ? b : a));

  const cols: {
    head: string;
    hint: string;
    get: (s: ArmStat) => string;
    win: ArmStat;
  }[] = [
    { head: "Picked #1", hint: "agent's single choice", get: (s) => `${s.wins}/${s.total}`, win: best((s) => s.wins) },
    { head: "Recall@3", hint: "made the shortlist", get: (s) => s.recallAt3.toFixed(2), win: best((s) => s.recallAt3) },
    { head: "MRR", hint: "mean reciprocal rank", get: (s) => s.mrr.toFixed(3), win: best((s) => s.mrr) },
    { head: "Mean rank", hint: "lower is better", get: (s) => s.meanRank.toFixed(2), win: best((s) => s.meanRank, true) },
    { head: "Words", hint: "length control", get: (s) => String(s.meanWords), win: stats[0] },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="py-2 pr-4 text-left font-medium">Content arm</th>
            {cols.map((c) => (
              <th key={c.head} className="px-3 py-2 text-right font-medium">
                {c.head}
                <span className="block text-[10px] font-normal text-[var(--muted)]">
                  {c.hint}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.arm} className="border-b border-[var(--border)]">
              <td className="py-2.5 pr-4">
                <span className="font-medium">{s.label}</span>
                {s.arm === "bloat" && (
                  <span className="ml-2 text-[11px] text-[var(--warn)]">control</span>
                )}
              </td>
              {cols.map((c) => {
                const isWin = c.win.arm === s.arm && c.head !== "Words";
                return (
                  <td
                    key={c.head}
                    className="px-3 py-2.5 text-right tabular-nums"
                    style={{
                      color: isWin ? "var(--accent)" : "var(--muted)",
                      fontWeight: isWin ? 600 : 400,
                    }}
                  >
                    {c.get(s)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** States the ablation's conclusion in words, so a judge cannot misread it. */
function VerdictNote({ stats }: { stats: ArmStat[] }) {
  const raw = stats.find((s) => s.arm === "raw");
  const bloat = stats.find((s) => s.arm === "bloat");
  const opt = stats.find((s) => s.arm === "optimized");
  if (!raw || !bloat || !opt) return null;

  const lengthEffect = raw.mrr ? (bloat.mrr - raw.mrr) / raw.mrr : 0;
  const totalEffect = raw.mrr ? (opt.mrr - raw.mrr) / raw.mrr : 0;
  const structureWon = opt.mrr > bloat.mrr;

  return (
    <p className="mt-3 max-w-[74ch] text-xs leading-relaxed text-[var(--muted)]">
      <span className="text-[var(--foreground)]">Reading this: </span>
      the bloat arm is the original padded to{" "}
      <span className="tabular-nums">{bloat.meanWords}</span> words with no new
      facts. It moves MRR by{" "}
      <span className="tabular-nums">{(lengthEffect * 100).toFixed(0)}%</span>,
      while the full rewrite moves it by{" "}
      <span className="tabular-nums text-[var(--accent)]">
        {(totalEffect * 100).toFixed(0)}%
      </span>
      .{" "}
      {structureWon
        ? "The gain therefore comes from structure, not length — length alone is controlled for."
        : "On this run length accounts for most of the gain, so the structural claim is not supported and the rewrite needs work."}{" "}
      Verbosity bias in LLM judges is documented (Wang et al., ACL 2024); this
      arm exists to rule it out.
    </p>
  );
}
