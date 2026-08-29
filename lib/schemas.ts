import { z } from "zod";
import { DIMENSIONS } from "./dimensions";

export const productSchema = z.object({
  title: z.string().min(1),
  specs: z.string().default(""),
  copy: z.string().default(""),
});
export type Product = z.infer<typeof productSchema>;

const dimensionKeys = DIMENSIONS.map((d) => d.key) as [string, ...string[]];

export const dimensionScoreSchema = z.object({
  key: z.enum(dimensionKeys),
  score: z.number().min(0).max(100),
  reason: z.string().describe("One sentence, quoting or citing the content."),
  gap: z
    .string()
    .describe(
      "The single most valuable thing missing on this axis, phrased as an action. Empty string if the axis is already strong.",
    ),
});

export const scoreSchema = z.object({
  category: z
    .string()
    .describe("The product category you inferred, in two or three words."),
  dimensions: z.array(dimensionScoreSchema).length(DIMENSIONS.length),
  summary: z
    .string()
    .describe(
      "Two sentences: what an agent can and cannot conclude from this listing today.",
    ),
});
export type ScoreResult = z.infer<typeof scoreSchema>;

export const personaVariantSchema = z.object({
  persona: z.string().describe("Who this variant speaks to, 2-5 words."),
  intent: z.string().describe("The buying intent this persona arrives with."),
  content: z.string().describe("The rewritten listing for this persona."),
});

export const optimizeSchema = z.object({
  optimized: z
    .string()
    .describe(
      "The agent-ready listing in markdown. Sections: overview, Best for, Not for, Key attributes as a key/value list with units, How it compares, Constraints answered, Evidence.",
    ),
  attributes: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe("Machine-parseable attributes extracted or inferred with units."),
  additions: z
    .array(z.string())
    .describe("The specific facts or framings you added, one per item."),
  assumptions: z
    .array(z.string())
    .describe(
      "Anything you inferred rather than read from the source, so the brand can verify before publishing.",
    ),
  personas: z.array(personaVariantSchema).min(2).max(3),
});
export type OptimizeResult = z.infer<typeof optimizeSchema>;

export const rankingSchema = z.object({
  ranking: z
    .array(z.string())
    .describe("Listing ids, best match first. Exclude nothing."),
  pickId: z.string().describe("The id of the single listing you recommend."),
  reasoning: z
    .string()
    .describe("Two sentences on why the pick won and the runner-up lost."),
  confidence: z.number().min(0).max(100),
});
export type RankingResult = z.infer<typeof rankingSchema>;

export const queryBankSchema = z.object({
  category: z.string(),
  queries: z.array(z.string()).min(8).max(20),
  competitors: z
    .array(z.object({ title: z.string(), content: z.string() }))
    .min(3)
    .max(4)
    .describe(
      "Plausible rival listings in this category, already written to a good agent-ready standard, so the target has to earn its ranking.",
    ),
});
export type QueryBank = z.infer<typeof queryBankSchema>;

export const bloatSchema = z.object({
  bloated: z.string().describe("The padded listing. Prose only, no new facts."),
});
