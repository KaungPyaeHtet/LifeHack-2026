"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/presets";
import { DIMENSION_MAP, type DimensionKey } from "@/lib/dimensions";
import type { OptimizeResult, Product, QueryBank } from "@/lib/schemas";
import type { Trial } from "@/lib/simulate";
import { toJsonLd, download } from "@/lib/export";
import {
  bandColor, Button, Callout, Chip, CountUp, DeltaBar, DualDial, MiniBar,
  Panel, Pill, Progress, Section, Spinner, Stat, type StepState,
} from "./components/ui";
import { Footer, NavBar, SourceBadge } from "./components/chrome";
import { RadarPanel } from "./components/RadarPanel";
import {
  bloatProduct, buildQueryBank, dimMap, optimizeProduct, originalContent,
  scoreProduct, streamSimulation, type Arm, type ArmStat, type Scored, type Summary,
} from "./components/pipeline";
import demoData from "@/lib/demo-data.json";

type Stage = null | "score" | "optimize" | "querybank" | "bloat" | "simulate";

const wordsIn = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * Models answer the confidence field on either scale despite the schema
 * asking for 0-100, and the cached run was recorded as a fraction. Normalise
 * at the display boundary so both read correctly.
 */
const confPct = (c: number) => Math.round(c <= 1 ? c * 100 : c);

export default function Home() {
  const [product, setProduct] = useState<Product>(CATEGORIES[0].sample);
  const [busy, setBusy] = useState<Stage>(null);
  const [chained, setChained] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"idle" | "live" | "cached">("idle");

  const [score, setScore] = useState<Scored | null>(null);
  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [afterScore, setAfterScore] = useState<Scored | null>(null);
  const [bank, setBank] = useState<QueryBank | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [arms, setArms] = useState<Arm[]>([]);
  const [personaTab, setPersonaTab] = useState(0);
  const [showLog, setShowLog] = useState(false);

  const reset = () => {
    setScore(null); setOptimized(null); setAfterScore(null);
    setBank(null); setTrials([]); setSummary(null); setArms([]);
    setError(null); setPersonaTab(0); setShowLog(false);
  };

  /**
   * A cached real run of the pipeline. Live LLM latency is the one thing that
   * can sink a timed demo, so the full result is replayable offline — same
   * numbers, no network.
   */
  const loadDemo = useCallback(() => {
    setError(null);
    setSource("cached");
    setProduct(demoData.product as Product);
    setScore(demoData.score as unknown as Scored);
    setOptimized(demoData.optimized as unknown as OptimizeResult);
    setAfterScore(demoData.afterScore as unknown as Scored);
    setBank(demoData.bank as unknown as QueryBank);
    setTrials(demoData.trials as unknown as Trial[]);
    setSummary(demoData.summary as unknown as Summary);
    setArms(demoData.arms as unknown as Arm[]);
    setPersonaTab(0);
    requestAnimationFrame(() =>
      document.getElementById("outcome")?.scrollIntoView({ block: "start" }),
    );
  }, []);

  // Presenter shortcut. Guarded against fields so typing a listing is safe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") loadDemo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadDemo]);

  const guard = async (stage: Stage, fn: () => Promise<void>) => {
    setBusy(stage); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); setChained(false); }
  };

  /* --- stages, written to return their result so they can be chained without
         waiting on React state to settle between them ------------------- */

  const doScore = async (p: Product) => {
    setSource("live");
    const s = await scoreProduct(p);
    setScore(s);
    return s;
  };

  const doOptimize = async (p: Product, s: Scored) => {
    setBusy("optimize");
    const gaps = s.dimensions.filter((d) => d.gap).map((d) => d.gap);
    const result = await optimizeProduct(p, gaps);
    setOptimized(result);
    // Re-score the rewrite through the identical rubric — the improvement
    // has to survive the same judge, not a friendlier one.
    setAfterScore(
      await scoreProduct({ title: p.title, specs: "", copy: result.optimized }),
    );
    return result;
  };

  const doSimulate = async (p: Product, opt: OptimizeResult) => {
    setBusy("querybank");
    const queryBank = await buildQueryBank(p);
    setBank(queryBank);

    // The bloat arm exists so the headline number survives the obvious
    // challenge: LLM judges favour longer text, and the rewrite IS longer.
    // Padding the original to a matched length with no new facts separates
    // length from structure.
    setBusy("bloat");
    const raw = originalContent(p);
    const optimizedFull = `${p.title}\n\n${opt.optimized}`;
    const { bloated } = await bloatProduct(p, Math.round(wordsIn(optimizedFull)));

    const armSet: Arm[] = [
      { id: "raw", label: "Raw catalogue", content: raw },
      { id: "bloat", label: "Bloat control", content: `${p.title}\n\n${bloated}` },
      { id: "optimized", label: "AgentRank", content: optimizedFull },
    ];
    setArms(armSet);

    setBusy("simulate");
    setTrials([]); setSummary(null);
    setSummary(
      await streamSimulation(
        { arms: armSet, queries: queryBank.queries, competitors: queryBank.competitors },
        (t) => setTrials((prev) => [...prev, t]),
      ),
    );
  };

  /* ------------------------------------------------------------ actions */

  const runScore = () =>
    guard("score", async () => {
      reset();
      await doScore(product);
    });

  const runOptimize = () =>
    guard("optimize", async () => {
      if (score) await doOptimize(product, score);
    });

  const runSimulation = () =>
    guard("simulate", async () => {
      if (optimized) await doSimulate(product, optimized);
    });

  /** One click, all four stages. The demo path when the key is live. */
  const runAll = () => {
    setChained(true);
    return guard("score", async () => {
      reset();
      document.getElementById("input")?.scrollIntoView({ block: "start" });
      const s = await doScore(product);
      const o = await doOptimize(product, s);
      await doSimulate(product, o);
    });
  };

  /* -------------------------------------------------------------- derived */

  const totalTrials = bank ? bank.queries.length * (arms.length || 3) : 0;
  const progress = totalTrials
    ? Math.round((trials.length / totalTrials) * 100)
    : 0;

  const stepState = (done: boolean, running: boolean): StepState =>
    running ? "running" : done ? "done" : "idle";

  const states = {
    input: stepState(true, false),
    score: stepState(!!score, busy === "score"),
    optimize: stepState(!!optimized, busy === "optimize"),
    ablation: stepState(
      !!summary,
      busy === "querybank" || busy === "bloat" || busy === "simulate",
    ),
  };

  const armLabels = useMemo(
    () => Object.fromEntries(arms.map((a) => [a.id, a.label])),
    [arms],
  );

  const busyLabel: Record<Exclude<Stage, null>, string> = {
    score: "Scoring readiness…",
    optimize: "Rewriting listing…",
    querybank: "Generating query bank…",
    bloat: "Building length control…",
    simulate: `Running agents… ${progress}%`,
  };

  return (
    <>
      <NavBar status={<SourceBadge mode={source} />} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16">
        <Hero
          onDemo={loadDemo}
          onRunAll={runAll}
          busy={busy}
          chained={chained}
          busyLabel={busy ? busyLabel[busy] : ""}
          states={states}
        />

        {error && (
          <div className="card fadeup mb-5 border-[var(--bad-dim)] bg-[rgb(240_138_138/0.06)] p-4 text-sm text-[var(--bad)]">
            <span className="font-medium">Run failed. </span>
            {error}
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Press <kbd className="mono rounded border border-[var(--border)] px-1">D</kbd>{" "}
              or hit “Load cached run” to show the recorded result instead.
            </span>
          </div>
        )}

        {summary && score && afterScore && (
          <ResultsStrip
            score={score}
            afterScore={afterScore}
            stats={summary.stats}
          />
        )}

        <div id="results" className="space-y-5">
          {/* -------------------------------------------------------- INPUT */}
          <Section
            id="input"
            step={1}
            state={states.input}
            title="Raw catalogue content"
            subtitle="Paste a listing exactly as it exists today. Any category — nothing downstream is category-specific."
            aside={
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.key}
                    active={product.title === c.sample.title}
                    onClick={() => { setProduct(c.sample); reset(); setSource("idle"); }}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
            }
          >
            <div className="grid gap-4">
              <Field label="Product title">
                <input
                  value={product.title}
                  onChange={(e) => setProduct({ ...product, title: e.target.value })}
                  placeholder="e.g. Aerolite Pace 3 Running Shoe"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Specs / bullets" meta={`${wordsIn(product.specs)} words`}>
                  <textarea
                    rows={7}
                    value={product.specs}
                    onChange={(e) => setProduct({ ...product, specs: e.target.value })}
                  />
                </Field>
                <Field label="Marketing copy" meta={`${wordsIn(product.copy)} words`}>
                  <textarea
                    rows={7}
                    value={product.copy}
                    onChange={(e) => setProduct({ ...product, copy: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runScore} disabled={busy !== null || !product.title}>
                  {busy === "score" && !chained
                    ? <><Spinner /> Scoring…</>
                    : "Score readiness"}
                </Button>
                <Button variant="ghost" onClick={runAll} disabled={busy !== null || !product.title}>
                  {chained && busy ? <><Spinner /> {busyLabel[busy]}</> : "Run all four stages"}
                </Button>
                <span className="text-[11px] text-[var(--faint)]">
                  {wordsIn(originalContent(product))} words in, six axes out.
                </span>
              </div>
            </div>
          </Section>

          {/* -------------------------------------------------------- SCORE */}
          {score && (
            <Section
              id="score"
              step={2}
              state={states.score}
              title="Agent readiness score"
              subtitle={`Inferred category: ${score.category}. Each axis judged against a written rubric, not keyword presence.`}
              aside={
                afterScore && (
                  <Pill tone="good">
                    Re-scored through the identical rubric
                  </Pill>
                )
              }
            >
              <div className="grid items-center gap-8 md:grid-cols-[180px_1fr]">
                <DualDial before={score.overall} after={afterScore?.overall} />
                <RadarPanel
                  before={dimMap(score)}
                  after={afterScore ? dimMap(afterScore) : undefined}
                />
              </div>

              <p className="mt-4 max-w-[72ch] text-[13px] leading-relaxed text-[var(--muted)]">
                {score.summary}
              </p>

              <div className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {score.dimensions.map((d) => {
                  const after = afterScore?.dimensions.find((x) => x.key === d.key);
                  const dim = DIMENSION_MAP[d.key as DimensionKey];
                  const delta = after ? after.score - d.score : null;
                  return (
                    <div
                      key={d.key}
                      className="grid items-start gap-x-8 gap-y-2.5 py-4 sm:grid-cols-[1fr_210px]"
                    >
                      <div className="max-w-[64ch]">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h4 className="text-[13px] font-semibold">{dim.label}</h4>
                          <span className="eyebrow">weight {dim.weight.toFixed(2)}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                          {d.reason}
                        </p>
                        {d.gap && !optimized && (
                          <p className="mt-1.5 text-xs text-[var(--warn)]">
                            <span className="eyebrow text-[var(--warn)]">Gap </span>
                            {d.gap}
                          </p>
                        )}
                      </div>

                      <div className="sm:pt-0.5">
                        <div className="mb-1.5 flex items-baseline gap-1.5 text-sm num">
                          <span style={{ color: after ? "var(--warn)" : bandColor(d.score) }}>
                            {d.score}
                          </span>
                          {after && (
                            <>
                              <span className="text-[var(--faint)]">→</span>
                              <span
                                className="font-semibold"
                                style={{ color: bandColor(after.score) }}
                              >
                                {after.score}
                              </span>
                              <span
                                className="ml-auto text-xs font-medium"
                                style={{
                                  color: delta! >= 0 ? "var(--accent)" : "var(--bad)",
                                }}
                              >
                                {delta! >= 0 ? "+" : ""}{delta}
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

          {/* ----------------------------------------------------- OPTIMIZE */}
          {optimized && (
            <Section
              id="rewrite"
              step={3}
              state={states.optimize}
              title="Agent-ready rewrite"
              subtitle="Same underlying facts, restructured so an agent can cite them — and reject on them."
              aside={
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
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
                    size="sm"
                    onClick={() => download("listing.md", optimized.optimized, "text/markdown")}
                  >
                    Export .md
                  </Button>
                </div>
              }
            >
              <div className="grid gap-3 lg:grid-cols-2">
                <Panel
                  title="Before — as published"
                  tone="bad"
                  meta={<span className="text-[11px] num text-[var(--faint)]">
                    {wordsIn(originalContent(product))} words
                  </span>}
                >
                  <pre className="mono whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
                    {originalContent(product)}
                  </pre>
                </Panel>
                <Panel
                  title="After — agent-ready"
                  tone="good"
                  meta={<span className="text-[11px] num text-[var(--faint)]">
                    {wordsIn(optimized.optimized)} words
                  </span>}
                >
                  <pre className="mono whitespace-pre-wrap text-xs leading-relaxed">
                    {optimized.optimized}
                  </pre>
                </Panel>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Panel title={`Structured attributes · ${optimized.attributes.length}`}>
                  <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1.5 text-xs">
                    {optimized.attributes.map((a) => (
                      <div key={a.name} className="contents">
                        <dt className="text-[var(--muted)]">{a.name}</dt>
                        <dd className="num text-right sm:text-left">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel title="Needs brand verification" tone="warn">
                  <ul className="space-y-1.5 text-xs text-[var(--warn)]">
                    {optimized.assumptions.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[var(--warn-dim)]">▸</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-[var(--border)] pt-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
                    Inferences are surfaced, never silently published. No invented
                    certifications, test results or prices — this is what makes the
                    rewrite safe for a brand to ship.
                  </p>
                </Panel>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="eyebrow mr-1">Persona variants</span>
                  {optimized.personas.map((p, i) => (
                    <Chip
                      key={p.persona}
                      active={personaTab === i}
                      onClick={() => setPersonaTab(i)}
                    >
                      {p.persona}
                    </Chip>
                  ))}
                </div>
                <Panel
                  title={`Variant · ${optimized.personas[personaTab]?.persona ?? ""}`}
                  tone="good"
                >
                  <p className="mb-3 border-l-2 border-[var(--accent-dim)] pl-3 text-xs leading-relaxed text-[var(--muted)]">
                    <span className="text-[var(--foreground)]">Arrives with: </span>
                    {optimized.personas[personaTab]?.intent}
                  </p>
                  <pre className="mono whitespace-pre-wrap text-xs leading-relaxed">
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

          {/* ----------------------------------------------------- SIMULATE */}
          {(trials.length > 0 || summary || states.ablation === "running") && (
            <Section
              id="ablation"
              step={4}
              state={states.ablation}
              title="Controlled ablation"
              subtitle={
                bank
                  ? `${bank.queries.length} shopper queries × ${bank.competitors.length + 1} listings × 3 content arms. Same query, same rivals, same agent — only the target's content changes.`
                  : "Same query, same rivals, same agent — only the target's content changes between arms."
              }
              aside={
                summary ? (
                  <Pill tone="good">{trials.length} agent decisions</Pill>
                ) : (
                  <Pill tone="warn">
                    <span className="pulsedot">●</span> streaming
                  </Pill>
                )
              }
            >
              {summary ? (
                <>
                  <ArmTable stats={summary.stats} />
                  <VerdictNote stats={summary.stats} />

                  <h3 className="mt-7 mb-1 text-sm font-semibold">
                    Where the rewrite changed the agent&apos;s mind
                  </h3>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    The agent&apos;s own reasoning, on the queries that flipped.
                  </p>
                  <div className="grid gap-2.5">
                    {summary.flips.map((f) => (
                      <FlipCard key={f.query} flip={f} />
                    ))}
                    {summary.flips.length === 0 && (
                      <p className="text-sm text-[var(--muted)]">
                        No queries flipped on this run.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setShowLog((v) => !v)}
                    className="mt-5 text-xs text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
                  >
                    {showLog ? "Hide" : "Show"} all {trials.length} agent decisions
                  </button>
                  {showLog && (
                    <div className="mt-3">
                      <TrialFeed trials={trials} armLabels={armLabels} limit={trials.length} />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="mb-2 flex items-baseline justify-between text-xs">
                    <span className="text-[var(--muted)]">
                      {busy === "querybank"
                        ? "Generating a category-agnostic query bank and rival listings…"
                        : busy === "bloat"
                          ? "Padding the original to a matched length with no new facts…"
                          : "Agents ranking listings"}
                    </span>
                    <span className="num text-[var(--muted)]">
                      {trials.length} / {totalTrials || "—"}
                    </span>
                  </div>
                  <Progress value={progress} active />
                  <div className="mt-4">
                    <TrialFeed trials={trials} armLabels={armLabels} limit={9} />
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ======================================================================
   Hero
   =================================================================== */

const RAIL = [
  { n: 1, label: "Score", note: "six rubric axes" },
  { n: 2, label: "Optimize", note: "same facts, restructured" },
  { n: 3, label: "Ablate", note: "vs a length-matched control" },
  { n: 4, label: "Prove", note: "MRR, Recall@3, nDCG" },
];

function Hero({
  onDemo, onRunAll, busy, chained, busyLabel, states,
}: {
  onDemo: () => void;
  onRunAll: () => void;
  busy: Stage;
  chained: boolean;
  busyLabel: string;
  states: Record<string, StepState>;
}) {
  const railState = [states.input, states.score, states.optimize, states.ablation];

  return (
    <header className="fadeup py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="good">LifeHack NUS 2026 · Rezolve AI track</Pill>
        <Pill>Agentic commerce readiness</Pill>
      </div>

      <h1 className="mt-5 max-w-[20ch] text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">
        Your product ranks #1 on Google.{" "}
        <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
          Where does it rank with an agent?
        </span>
      </h1>

      <p className="mt-5 max-w-[64ch] text-[15px] leading-relaxed text-[var(--muted)]">
        Shoppers now put constrained questions to AI agents. An agent can only
        recommend a product it can reason about, and most catalogue content
        gives it nothing to reason with. AgentRank scores whether an agent could
        act on a listing, rewrites it so it can, then{" "}
        <span className="text-[var(--foreground)]">
          proves the difference with a controlled ablation
        </span>{" "}
        rather than asserting it.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Button onClick={onDemo}>
          Load cached run
          <kbd className="mono ml-1 rounded border border-[#0a3b32]/40 bg-[#03211c]/15 px-1 text-[10px]">
            D
          </kbd>
        </Button>
        <Button variant="ghost" onClick={onRunAll} disabled={busy !== null}>
          {chained && busy ? <><Spinner /> {busyLabel}</> : "Run live pipeline"}
        </Button>
        <span className="text-xs text-[var(--faint)]">
          Cached replays a real end-to-end run with zero network calls.
        </span>
      </div>

      {/* The pipeline as a rail, so the four stages are legible before any of
          them has run — a judge should know the shape of the demo up front. */}
      <ol className="mt-9 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {RAIL.map((s, i) => {
          const st = railState[i];
          return (
            <li
              key={s.n}
              className={`inset flex items-center gap-3 p-3 transition ${
                st === "running"
                  ? "border-[var(--accent-dim)]"
                  : st === "done"
                    ? "border-[var(--border-strong)]"
                    : ""
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[11px] font-semibold num ${
                  st === "idle"
                    ? "border-[var(--border)] text-[var(--faint)]"
                    : "border-[var(--accent-dim)] bg-[rgb(94_234_212/0.1)] text-[var(--accent)]"
                } ${st === "running" ? "glowpulse" : ""}`}
              >
                {st === "running" ? <Spinner /> : s.n}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{s.label}</div>
                <div className="truncate text-[11px] text-[var(--faint)]">{s.note}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

/* ======================================================================
   Results strip — the payoff, above the detail
   =================================================================== */

function ResultsStrip({
  score, afterScore, stats,
}: {
  score: Scored;
  afterScore: Scored;
  stats: ArmStat[];
}) {
  const raw = stats.find((s) => s.arm === "raw");
  const opt = stats.find((s) => s.arm === "optimized");
  if (!raw || !opt) return null;

  const mrrLift = raw.mrr ? ((opt.mrr - raw.mrr) / raw.mrr) * 100 : 0;

  return (
    <div id="outcome" className="card fadeup mb-5 scroll-mt-20 overflow-hidden p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Measured outcome</h2>
        <span className="text-xs text-[var(--muted)]">
          one product, {raw.total} queries, three content arms, {raw.total * stats.length} agent decisions
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Readiness score"
          tone="good"
          bar={afterScore.overall}
          value={
            <span className="flex items-baseline gap-1.5">
              <span className="text-[var(--warn)]">{score.overall}</span>
              <span className="text-[var(--faint)] text-lg">→</span>
              <CountUp value={afterScore.overall} />
            </span>
          }
          sub={`+${afterScore.overall - score.overall} points on the identical rubric`}
        />
        <Stat
          label="Picked #1 by the agent"
          tone="good"
          bar={(opt.wins / opt.total) * 100}
          value={
            <span className="flex items-baseline gap-1.5">
              <span className="text-[var(--warn)]">{raw.wins}</span>
              <span className="text-[var(--faint)] text-lg">→</span>
              <CountUp value={opt.wins} />
              <span className="text-base text-[var(--faint)]">/ {opt.total}</span>
            </span>
          }
          sub="the agent's single recommendation"
        />
        <Stat
          label="Mean reciprocal rank"
          tone="good"
          bar={opt.mrr * 100}
          value={<CountUp value={mrrLift} decimals={0} prefix="+" suffix="%" />}
          sub={`${raw.mrr.toFixed(3)} → ${opt.mrr.toFixed(3)} against the same rivals`}
        />
        <Stat
          label="Recall@3"
          tone="good"
          bar={opt.recallAt3 * 100}
          value={
            <span className="flex items-baseline gap-1.5">
              <span className="text-[var(--warn)]">{raw.recallAt3.toFixed(2)}</span>
              <span className="text-[var(--faint)] text-lg">→</span>
              <CountUp value={opt.recallAt3} decimals={2} />
            </span>
          }
          sub="made the shortlist a shopper actually reads"
        />
      </div>
    </div>
  );
}

/* ======================================================================
   Pieces
   =================================================================== */

function Field({
  label, meta, children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        {meta && <span className="text-[10px] num text-[var(--faint)]">{meta}</span>}
      </span>
      {children}
    </label>
  );
}

const ARM_TONE: Record<string, { color: string; tone: "good" | "warn" | "bad" }> = {
  raw: { color: "var(--warn)", tone: "warn" },
  bloat: { color: "var(--bad)", tone: "bad" },
  optimized: { color: "var(--accent)", tone: "good" },
};

/** Live NDJSON feed. Each row is one agent's decision as it lands. */
function TrialFeed({
  trials, armLabels, limit,
}: {
  trials: Trial[];
  armLabels: Record<string, string>;
  limit: number;
}) {
  const rows = trials.slice(-limit).reverse();
  if (!rows.length) {
    return (
      <p className="inset p-4 text-xs text-[var(--faint)]">
        Waiting for the first decision…
      </p>
    );
  }
  return (
    <ul className="inset max-h-[340px] divide-y divide-[var(--border)] overflow-auto">
      {rows.map((t, i) => {
        const tone = ARM_TONE[t.arm] ?? ARM_TONE.raw;
        return (
          <li
            key={`${t.arm}-${t.query}-${i}`}
            className="slidein flex items-center gap-3 px-3 py-2 text-xs"
          >
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded num text-[10px] font-semibold"
              style={{
                color: t.won ? "#03211c" : tone.color,
                background: t.won ? "var(--accent)" : "transparent",
                boxShadow: t.won ? "none" : `inset 0 0 0 1px ${tone.color}55`,
              }}
              title={`rank ${t.rank} of ${t.total}`}
            >
              {t.rank}
            </span>
            <span
              className="w-[92px] shrink-0 truncate text-[11px] font-medium"
              style={{ color: tone.color }}
            >
              {armLabels[t.arm] ?? t.arm}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--muted)]">
              {t.query}
            </span>
            <span
              className="shrink-0 num text-[10px] text-[var(--faint)]"
              title="agent confidence in its pick"
            >
              {confPct(t.confidence)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FlipCard({ flip }: { flip: Summary["flips"][number] }) {
  return (
    <div className="inset p-3.5">
      <p className="text-sm">
        <span className="text-[var(--faint)]">Query · </span>
        &ldquo;{flip.query}&rdquo;
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--border)] bg-[rgb(245_194_107/0.04)] p-2.5">
          <Pill tone="warn">
            Original — rank {flip.original?.rank}/{flip.original?.total}
          </Pill>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            {flip.original?.reasoning}
          </p>
        </div>
        <div className="rounded-md border border-[var(--accent-dim)] bg-[rgb(94_234_212/0.05)] p-2.5">
          <Pill tone="good">Agent-ready — picked #1</Pill>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            {flip.optimizedReasoning}
          </p>
        </div>
      </div>
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
    frac: (s: ArmStat) => number;
    max: number;
    win: ArmStat;
  }[] = [
    {
      head: "Picked #1", hint: "the agent's single choice",
      get: (s) => `${s.wins}/${s.total}`,
      frac: (s) => s.wins / (s.total || 1), max: 1,
      win: best((s) => s.wins),
    },
    {
      head: "Recall@3", hint: "made the shortlist",
      get: (s) => s.recallAt3.toFixed(2),
      frac: (s) => s.recallAt3, max: 1,
      win: best((s) => s.recallAt3),
    },
    {
      head: "MRR", hint: "mean reciprocal rank",
      get: (s) => s.mrr.toFixed(3),
      frac: (s) => s.mrr, max: 1,
      win: best((s) => s.mrr),
    },
    {
      head: "Mean rank", hint: "lower is better",
      get: (s) => s.meanRank.toFixed(2),
      frac: (s) => 1 - s.meanRank / Math.max(...stats.map((x) => x.meanRank)),
      max: 1,
      win: best((s) => s.meanRank, true),
    },
    {
      head: "Words", hint: "length, controlled",
      get: (s) => String(s.meanWords),
      frac: (s) => s.meanWords / Math.max(...stats.map((x) => x.meanWords)),
      max: 1,
      win: stats[0],
    },
  ];

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="py-2.5 pr-4 text-left align-bottom">
              <span className="eyebrow">Content arm</span>
            </th>
            {cols.map((c) => (
              <th key={c.head} className="px-3 py-2.5 text-right align-bottom font-medium">
                <span className="text-[13px]">{c.head}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-[var(--faint)]">
                  {c.hint}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const tone = ARM_TONE[s.arm] ?? ARM_TONE.raw;
            const isTarget = s.arm === "optimized";
            return (
              <tr
                key={s.arm}
                className="border-b border-[var(--border)]"
                style={isTarget ? { background: "rgb(94 234 212 / 0.045)" } : undefined}
              >
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-1 rounded-full"
                      style={{ background: tone.color }}
                    />
                    <span
                      className="font-medium"
                      style={{ color: isTarget ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {s.label}
                    </span>
                    {s.arm === "bloat" && <Pill tone="bad">control</Pill>}
                  </span>
                </td>
                {cols.map((c) => {
                  const isWin = c.win.arm === s.arm && c.head !== "Words";
                  const color = isWin ? "var(--accent)" : "var(--muted)";
                  return (
                    <td key={c.head} className="px-3 py-3 text-right align-middle">
                      <span
                        className="num text-[13px]"
                        style={{ color, fontWeight: isWin ? 600 : 400 }}
                      >
                        {c.get(s)}
                      </span>
                      <MiniBar
                        value={c.frac(s)}
                        max={c.max}
                        color={isWin ? "var(--accent)" : "var(--border-strong)"}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
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
    <Callout label="Reading this:">
      the bloat arm is the original padded to{" "}
      <span className="num text-[var(--foreground)]">{bloat.meanWords}</span> words
      with no new facts — {(bloat.meanWords / (raw.meanWords || 1)).toFixed(1)}× the
      original. It moves MRR by{" "}
      <span
        className="num font-medium"
        style={{ color: lengthEffect < 0 ? "var(--bad)" : "var(--warn)" }}
      >
        {(lengthEffect * 100).toFixed(0)}%
      </span>
      , while the full rewrite moves it by{" "}
      <span className="num font-medium text-[var(--accent)]">
        +{(totalEffect * 100).toFixed(0)}%
      </span>
      .{" "}
      {structureWon
        ? "The gain therefore comes from structure, not length — length alone is controlled for."
        : "On this run length accounts for most of the gain, so the structural claim is not supported and the rewrite needs work."}{" "}
      Verbosity bias in LLM judges is documented (Wang et al., ACL 2024); this arm
      exists to rule it out.
    </Callout>
  );
}
