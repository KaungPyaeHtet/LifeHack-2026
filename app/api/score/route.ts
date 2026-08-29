import { NextResponse } from "next/server";
import { structured, requireKey, MissingKeyError } from "@/lib/ai";
import { productSchema, scoreSchema } from "@/lib/schemas";
import { SCORE_SYSTEM, scorePrompt } from "@/lib/prompts";
import { weightedScore, type DimensionKey } from "@/lib/dimensions";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    requireKey();
    const product = productSchema.parse(await req.json());
    const result = await structured({
      schema: scoreSchema,
      system: SCORE_SYSTEM,
      prompt: scorePrompt(product),
    });
    const map = Object.fromEntries(
      result.dimensions.map((d) => [d.key, d.score]),
    ) as Record<DimensionKey, number>;
    return NextResponse.json({ ...result, overall: weightedScore(map) });
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown) {
  const status = err instanceof MissingKeyError ? 402 : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status });
}
