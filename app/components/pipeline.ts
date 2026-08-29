import type {
  OptimizeResult, Product, QueryBank, ScoreResult,
} from "@/lib/schemas";
import type { DimensionKey } from "@/lib/dimensions";
import type { Trial } from "@/lib/simulate";

export type Scored = ScoreResult & { overall: number };

export interface ArmStat {
  wins: number;
  topThree: number;
  total: number;
  meanRank: number;
}

export interface Summary {
  original: ArmStat;
  optimized: ArmStat;
  flips: {
    query: string;
    optimizedReasoning: string;
    original?: Trial;
  }[];
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `${url} failed (${res.status})`);
  }
  return res.json();
}

export const scoreProduct = (product: Product) =>
  post<Scored>("/api/score", product);

export const optimizeProduct = (product: Product, gaps: string[]) =>
  post<OptimizeResult>("/api/optimize", { product, gaps });

export const buildQueryBank = (product: Product) =>
  post<QueryBank>("/api/querybank", product);

export function dimMap(s: ScoreResult): Record<DimensionKey, number> {
  return Object.fromEntries(
    s.dimensions.map((d) => [d.key, d.score]),
  ) as Record<DimensionKey, number>;
}

/** Plain text of the original listing, as the simulated agent will see it. */
export function originalContent(p: Product): string {
  return [p.title, p.specs, p.copy].filter(Boolean).join("\n\n");
}

export async function streamSimulation(
  body: {
    originalContent: string;
    optimizedContent: string;
    queries: string[];
    competitors: { title: string; content: string }[];
  },
  onTrial: (t: Trial) => void,
): Promise<Summary> {
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Simulation failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: Summary | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "trial") onTrial(msg.trial as Trial);
      if (msg.type === "summary") summary = msg as Summary;
    }
  }
  if (!summary) throw new Error("Simulation ended without a summary");
  return summary;
}
