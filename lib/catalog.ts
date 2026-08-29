import { z } from "zod";

/**
 * A catalogue item carries three separate things, and keeping them separate is
 * what makes the benchmark honest:
 *
 *  - `facts`   the ground truth about the product. NEVER shown to the ranker.
 *              Relevance labels are graded from this alone, so the labels
 *              describe what the product IS, not how well it is described.
 *  - `raw`     the brand's actual PDP copy: vague, incomplete, human-facing.
 *  - `agentReady` the same underlying facts, restructured.
 *
 * Because ground truth is fixed and independent of the content, improving the
 * content cannot move the target. That is the difference between measuring a
 * retrieval improvement and marking your own homework.
 */
export const catalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  facts: z.string().describe("Ground truth spec sheet. Hidden from retrieval."),
  raw: z.string().describe("Vague human-facing marketing copy."),
  agentReady: z.string().describe("Agent-optimized listing, same facts."),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const shopperSchema = z.object({
  id: z.string(),
  label: z.string(),
  query: z.string(),
  profile: z.string(),
});
export type Shopper = z.infer<typeof shopperSchema>;

/** ESCI-style graded relevance, as used by the Amazon Shopping Queries dataset. */
export const RELEVANCE_GAINS = { E: 3, S: 2, C: 1, I: 0 } as const;
export type RelevanceLabel = keyof typeof RELEVANCE_GAINS;

export const relevanceSchema = z.object({
  labels: z.array(
    z.object({
      id: z.string(),
      label: z.enum(["E", "S", "C", "I"]),
      why: z.string().describe("One short clause."),
    }),
  ),
});

/**
 * nDCG@k against graded labels (Järvelin & Kekäläinen, 2002). Reported because
 * the shopper sees a top-3: a metric that only asks "was the best item first"
 * would ignore the other two slots the shopper actually reads.
 */
export function ndcgAtK(
  ranked: string[],
  labels: Record<string, RelevanceLabel>,
  k = 3,
): number {
  const gain = (id: string): number => RELEVANCE_GAINS[labels[id] ?? "I"];
  const dcg = ranked
    .slice(0, k)
    .reduce((sum, id, i) => sum + gain(id) / Math.log2(i + 2), 0);

  const ideal = Object.values(labels)
    .map((l): number => RELEVANCE_GAINS[l])
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, g, i) => sum + g / Math.log2(i + 2), 0);

  return ideal === 0 ? 0 : Number((dcg / ideal).toFixed(3));
}
