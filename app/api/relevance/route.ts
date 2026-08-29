import { NextResponse } from "next/server";
import { structured, requireKey } from "@/lib/ai";
import { RELEVANCE_SYSTEM, relevancePrompt } from "@/lib/prompts";
import { relevanceSchema, type CatalogItem } from "@/lib/catalog";
import { errorResponse } from "../score/route";
import catalog from "@/lib/catalog-data.json";
import { z } from "zod";

export const maxDuration = 180;

/**
 * Ground truth, graded from each product's true specification rather than its
 * marketing copy. Because the labels never see the content being tested, the
 * content cannot influence the target it is scored against.
 */
export async function POST(req: Request) {
  try {
    requireKey();
    const { profile, query } = z
      .object({ profile: z.string(), query: z.string() })
      .parse(await req.json());

    const items = (catalog as CatalogItem[]).map((i) => ({
      id: i.id,
      facts: `${i.title}\n${i.facts}`,
    }));

    const result = await structured({
      schema: relevanceSchema,
      system: RELEVANCE_SYSTEM,
      prompt: relevancePrompt(profile, query, items),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
