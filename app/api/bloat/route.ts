import { NextResponse } from "next/server";
import { structured, requireKey } from "@/lib/ai";
import { productSchema, bloatSchema } from "@/lib/schemas";
import { BLOAT_SYSTEM, bloatPrompt } from "@/lib/prompts";
import { errorResponse } from "../score/route";
import { z } from "zod";

export const maxDuration = 120;

const bodySchema = z.object({
  product: productSchema,
  targetWords: z.number().min(50).max(1200).default(400),
});

export async function POST(req: Request) {
  try {
    requireKey();
    const { product, targetWords } = bodySchema.parse(await req.json());
    const result = await structured({
      schema: bloatSchema,
      system: BLOAT_SYSTEM,
      prompt: bloatPrompt(product, targetWords),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
