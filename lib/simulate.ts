import { structured } from "./ai";
import { rankingSchema, type RankingResult } from "./schemas";
import { AGENT_SYSTEM, agentPrompt } from "./prompts";

export interface Candidate {
  id: string;
  content: string;
}

export type ArmId = string;

export interface Trial {
  query: string;
  arm: ArmId;
  won: boolean;
  rank: number;
  total: number;
  reasoning: string;
  confidence: number;
}

/**
 * Deterministic shuffle keyed by query+arm. Ranking LLMs have a real position
 * bias, so the target must not sit in a fixed slot — but the demo also has to
 * be reproducible, so we seed rather than use Math.random.
 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TARGET_ID = "L-04";

export async function runTrial(
  query: string,
  arm: ArmId,
  targetContent: string,
  competitors: { title: string; content: string }[],
): Promise<Trial> {
  const pool: Candidate[] = [
    { id: TARGET_ID, content: targetContent },
    ...competitors.map((c, i) => ({
      id: `L-${String(i + 10)}`,
      content: `${c.title}\n\n${c.content}`,
    })),
  ];
  const candidates = seededShuffle(pool, query + arm);

  let result: RankingResult;
  try {
    result = await structured({
      schema: rankingSchema,
      system: AGENT_SYSTEM,
      prompt: agentPrompt(query, candidates),
      fast: true,
    });
  } catch {
    // A single failed trial must not sink the run; count it as a loss.
    return {
      query,
      arm,
      won: false,
      rank: pool.length,
      total: pool.length,
      reasoning: "Agent call failed for this query.",
      confidence: 0,
    };
  }

  const idx = result.ranking.indexOf(TARGET_ID);
  return {
    query,
    arm,
    won: result.pickId === TARGET_ID,
    rank: idx === -1 ? pool.length : idx + 1,
    total: pool.length,
    reasoning: result.reasoning,
    confidence: result.confidence,
  };
}

/** Bounded-concurrency map — keeps the gateway happy during a live demo. */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onEach?: (result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      const r = await fn(items[i], i);
      results[i] = r;
      onEach?.(r);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------- METRICS */

/**
 * Rank-based IR metrics rather than raw win-rate. On a five-way race a single
 * "was it picked" bit throws away most of the signal — a listing moving from
 * 4th to 2nd is a real commercial gain that win-rate scores as zero.
 *
 * Reciprocal rank is the natural fit here: there is exactly one target per
 * query, so MRR is the standard measure. nDCG is deliberately NOT computed on
 * this stage — it needs graded relevance labels, which only exist in shopper
 * mode where an independent judge grades the whole catalogue.
 */
export interface ArmStat {
  arm: ArmId;
  label: string;
  wins: number;
  topThree: number;
  total: number;
  meanRank: number;
  mrr: number;
  recallAt3: number;
  meanWords: number;
}

export function armStats(
  trials: Trial[],
  arm: ArmId,
  label: string,
  words: number,
): ArmStat {
  const rows = trials.filter((t) => t.arm === arm);
  const n = rows.length || 1;
  const mean = (f: (t: Trial) => number) =>
    rows.reduce((s, t) => s + f(t), 0) / n;

  return {
    arm,
    label,
    wins: rows.filter((t) => t.won).length,
    topThree: rows.filter((t) => t.rank <= 3).length,
    total: rows.length,
    meanRank: round(mean((t) => t.rank)),
    mrr: round(mean((t) => 1 / t.rank), 3),
    recallAt3: round(rows.filter((t) => t.rank <= 3).length / n, 3),
    meanWords: words,
  };
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

export const wordCount = (s: string) =>
  s.trim().split(/\s+/).filter(Boolean).length;
