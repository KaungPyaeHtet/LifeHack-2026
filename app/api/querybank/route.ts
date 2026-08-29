import { NextResponse } from "next/server";
import { structured, requireKey } from "@/lib/ai";
import { productSchema, queryBankSchema } from "@/lib/schemas";
import { QUERYBANK_SYSTEM, queryBankPrompt } from "@/lib/prompts";
import { errorResponse } from "../score/route";

export const maxDuration = 120;

/**
 * Generalisability lives here. Nothing downstream knows what a running shoe
 * is — the evaluation set for any pasted product is derived at request time,
 * so a new category needs no code and no hand-written fixtures.
 */
export async function POST(req: Request) {
  try {
    requireKey();
    const product = productSchema.parse(await req.json());
    const result = await structured({
      schema: queryBankSchema,
      system: QUERYBANK_SYSTEM,
      prompt: queryBankPrompt(product),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
