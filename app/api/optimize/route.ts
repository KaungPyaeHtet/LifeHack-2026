import { NextResponse } from "next/server";
import { structured, requireKey } from "@/lib/ai";
import { productSchema, optimizeSchema } from "@/lib/schemas";
import { OPTIMIZE_SYSTEM, optimizePrompt } from "@/lib/prompts";
import { errorResponse } from "../score/route";
import { z } from "zod";

export const maxDuration = 180;

const bodySchema = z.object({
  product: productSchema,
  gaps: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    requireKey();
    const { product, gaps } = bodySchema.parse(await req.json());
    const result = await structured({
      schema: optimizeSchema,
      system: OPTIMIZE_SYSTEM,
      prompt: optimizePrompt(product, gaps),

    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
