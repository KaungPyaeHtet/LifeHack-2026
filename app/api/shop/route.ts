import { NextResponse } from "next/server";
import { structured, requireKey, shortlist } from "@/lib/ai";
import { SHOPPER_SYSTEM, shopperPrompt } from "@/lib/prompts";
import { errorResponse } from "../score/route";
import catalog from "@/lib/catalog-data.json";
import type { CatalogItem } from "@/lib/catalog";
import { z } from "zod";

export const maxDuration = 180;

const bodySchema = z.object({
  profile: z.string(),
  query: z.string(),
  mode: z.enum(["raw", "agentReady"]),
  shortlistSize: z.number().min(3).max(20).default(6),
});

const resultSchema = z.object({
  picks: z
    .array(
      z.object({
        id: z.string(),
        reason: z.string().describe("One sentence, addressed to the shopper."),
        unmet: z
          .string()
          .describe(
            "A constraint you could not verify from this listing, or empty string.",
          ),
      }),
    )
    .length(3),
  ranking: z.array(z.string()).describe("All shortlisted ids, best first."),
});

export async function POST(req: Request) {
  try {
    requireKey();
    const { profile, query, mode, shortlistSize } = bodySchema.parse(
      await req.json(),
    );
    const items = catalog as CatalogItem[];

    // Stage 1 — embed the same content the ranker will see. Retrieving on the
    // ground-truth facts would leak the answer and flatter both arms equally.
    const docs = items.map((i) => ({
      id: i.id,
      text: `${i.title}\n${mode === "raw" ? i.raw : i.agentReady}`,
    }));
    const top = await shortlist(`${profile}. ${query}`, docs, shortlistSize);
    const byId = new Map(items.map((i) => [i.id, i]));

    // Stage 2 — the model only ever reranks the shortlist.
    const candidates = top.map((t) => {
      const item = byId.get(t.id)!;
      return {
        id: item.id,
        content: `${item.title}\n${mode === "raw" ? item.raw : item.agentReady}`,
      };
    });

    const result = await structured({
      schema: resultSchema,
      system: SHOPPER_SYSTEM,
      prompt: shopperPrompt(profile, query, candidates),
    });

    return NextResponse.json({
      ...result,
      shortlisted: top.map((t) => t.id),
      titles: Object.fromEntries(items.map((i) => [i.id, i.title])),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
