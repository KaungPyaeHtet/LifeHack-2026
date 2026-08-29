import { requireKey, MissingKeyError } from "@/lib/ai";
import { runTrial, pooled, armStats, wordCount, type Trial } from "@/lib/simulate";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  /**
   * An ablation, not a demo. Every arm faces the same agent, the same rivals
   * and the same queries; only the target's content differs. That isolates
   * content as the single variable — which is the whole claim.
   */
  arms: z
    .array(z.object({ id: z.string(), label: z.string(), content: z.string() }))
    .min(2)
    .max(4),
  queries: z.array(z.string()).min(1).max(24),
  competitors: z
    .array(z.object({ title: z.string(), content: z.string() }))
    .min(1),
});

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
    body.arms.map((arm) => ({ query, arm })),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const trials = await pooled(
        jobs,
        6,
        (job) => runTrial(job.query, job.arm.id, job.arm.content, body.competitors),
        (trial) => send({ type: "trial", trial }),
      );

      send({
        type: "summary",
        stats: body.arms.map((a) =>
          armStats(trials, a.id, a.label, wordCount(a.content)),
        ),
        flips: findFlips(trials, body.arms[0].id, body.arms.at(-1)!.id),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}

/** Queries the baseline arm lost and the final arm won — the demo screen. */
function findFlips(trials: Trial[], baseArm: string, finalArm: string) {
  return trials
    .filter((t) => t.arm === finalArm && t.won)
    .map((t) => ({
      query: t.query,
      optimizedReasoning: t.reasoning,
      original: trials.find((x) => x.arm === baseArm && x.query === t.query),
    }))
    .filter((f) => f.original && !f.original.won)
    .slice(0, 4);
}
