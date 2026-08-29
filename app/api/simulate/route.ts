import { requireKey, MissingKeyError } from "@/lib/ai";
import { runTrial, pooled, type Trial } from "@/lib/simulate";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  originalContent: z.string(),
  optimizedContent: z.string(),
  queries: z.array(z.string()).min(1).max(24),
  competitors: z
    .array(z.object({ title: z.string(), content: z.string() }))
    .min(1),
});

/**
 * Streams NDJSON so the demo fills in trial by trial instead of staring at a
 * spinner for a minute. Each line is either a trial or the terminal summary.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    requireKey();
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const status = err instanceof MissingKeyError ? 402 : 400;
    return Response.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status },
    );
  }

  const jobs = body.queries.flatMap((query) =>
    (["original", "optimized"] as const).map((arm) => ({ query, arm })),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const trials = await pooled(
        jobs,
        6,
        (job) =>
          runTrial(
            job.query,
            job.arm,
            job.arm === "original" ? body.originalContent : body.optimizedContent,
            body.competitors,
          ),
        (trial) => send({ type: "trial", trial }),
      );

      send({ type: "summary", ...summarise(trials) });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}

function summarise(trials: Trial[]) {
  const of = (arm: Trial["arm"]) => trials.filter((t) => t.arm === arm);
  const stat = (arm: Trial["arm"]) => {
    const rows = of(arm);
    return {
      wins: rows.filter((t) => t.won).length,
      // Shortlisted, not just picked. Win-rate alone is a coarse signal on a
      // 5-way race; most agent surfaces show a top-3, so getting into it is a
      // real commercial outcome even when the product is not the single pick.
      topThree: rows.filter((t) => t.rank <= 3).length,
      total: rows.length,
      meanRank: rows.length
        ? Number(
            (rows.reduce((s, t) => s + t.rank, 0) / rows.length).toFixed(2),
          )
        : 0,
    };
  };

  // The demo screen: queries the original lost and the optimized version won.
  const flips = of("optimized")
    .filter((o) => o.won)
    .map((o) => ({
      query: o.query,
      optimizedReasoning: o.reasoning,
      original: of("original").find((x) => x.query === o.query),
    }))
    .filter((f) => f.original && !f.original.won)
    .slice(0, 4);

  return { original: stat("original"), optimized: stat("optimized"), flips };
}
