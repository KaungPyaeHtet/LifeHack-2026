import { cosineSimilarity, embedMany, generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";

/**
 * Two tiers, one pipeline. Scoring and rewriting are single deep calls, so
 * they get the stronger model; simulation fires 2x the query bank in parallel,
 * so it runs on the fast tier to keep a live demo inside a minute.
 */
export const REASONING_MODEL = process.env.AGENT_MODEL ?? "gpt-5.4";
export const FAST_MODEL = process.env.AGENT_FAST_MODEL ?? "gpt-5.4-mini";
export const EMBED_MODEL = process.env.AGENT_EMBED_MODEL ?? "text-embedding-3-small";

const usingGateway = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

export const hasKey = () => usingGateway() || Boolean(process.env.OPENAI_API_KEY);

/**
 * Prefer the AI Gateway when a key is present (observability, failover,
 * any provider by string id); fall back to the OpenAI provider directly.
 */
function resolveModel(id: string) {
  if (usingGateway()) return id.includes("/") ? id : `openai/${id}`;
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai(id.replace(/^openai\//, ""));
}

export async function structured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  fast?: boolean;
}): Promise<T> {
  const { output } = await generateText({
    model: resolveModel(opts.fast ? FAST_MODEL : REASONING_MODEL),
    system: opts.system,
    prompt: opts.prompt,
    output: Output.object({ schema: opts.schema }),
  });
  return output as T;
}

export class MissingKeyError extends Error {
  constructor() {
    super(
      "No model key found. Set OPENAI_API_KEY (or AI_GATEWAY_API_KEY) in .env.local, or switch on Demo mode for cached results.",
    );
  }
}

export function requireKey() {
  if (!hasKey()) throw new MissingKeyError();
}

/**
 * Stage one of retrieval. A production catalogue has tens of thousands of
 * SKUs and cannot be pasted into a prompt, so the LLM only ever reranks a
 * shortlist. Embeddings do the cheap wide pass; the model does the expensive
 * narrow one. Here the shortlist is computed per request because the catalogue
 * is small — at real scale these vectors live in an index and only the query
 * is embedded at query time.
 */
export async function shortlist(
  query: string,
  docs: { id: string; text: string }[],
  k: number,
): Promise<{ id: string; score: number }[]> {
  const model = usingGateway()
    ? `openai/${EMBED_MODEL}`
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).textEmbeddingModel(
        EMBED_MODEL,
      );

  const { embeddings } = await embedMany({
    model,
    values: [query, ...docs.map((d) => d.text)],
  });

  const [queryVec, ...docVecs] = embeddings;
  return docs
    .map((d, i) => ({ id: d.id, score: cosineSimilarity(queryVec, docVecs[i]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
