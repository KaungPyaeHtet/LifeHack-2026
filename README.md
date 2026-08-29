# AgentRank

**Your product ranks #1 on Google. Where does it rank with an agent?**

*LifeHack NUS — Rezolve AI track*

Brands write product content for humans who browse. Shoppers increasingly ask
AI agents constrained, intent-rich questions — *"lightweight shoes for a humid
half-marathon under S$200"*. An agent can only recommend a product it can
reason about, and most catalogue content gives it nothing to reason with. Good
products get skipped because of how their content is written.

This is one pipeline with three stages:

```
raw catalogue text → [1 SCORE] → [2 OPTIMIZE] → [3 SIMULATE] → measured proof
```

It does not just claim the rewrite is better. It makes the original and the
rewrite compete for the same shoppers, in front of the same agent, and reports
who won.

---

## Quick start

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

Open http://localhost:3000. Click **Load cached run** to replay a real
end-to-end result with no network calls, or paste any product and run it live.

Provider is auto-detected: `AI_GATEWAY_API_KEY` is used if present (Vercel AI
Gateway, any model by string id), otherwise `OPENAI_API_KEY` directly.
Override models with `AGENT_MODEL` / `AGENT_FAST_MODEL`.

---

## The three stages

### 1. Score — is this listing agent-recommendable?

Six axes, each judged by an LLM against a written rubric rather than keyword
presence. The question is always the same: *given only this text, could an
agent confidently recommend or reject this product for a specific constrained
question — and defend that answer?*

| Axis | Weight | What it catches |
|---|---|---|
| Use-case coverage | 0.20 | "running shoe" vs "half-marathon training in humid climates" |
| Persona relevance | 0.15 | who it's for, and who it's *not* for |
| Comparative framing | 0.15 | can the agent reason "better than X for Y"? |
| Attribute structure | 0.20 | machine-parseable facts with units, not prose |
| Constraint answerability | 0.20 | price, sizes, capacity, allergens, compatibility |
| Trust signal | 0.10 | claims an agent is willing to cite |

Weights are in `lib/dimensions.ts` — attributes and constraints are heaviest
because an agent that cannot parse a spec or check a price ceiling drops the
product before the softer signals matter.

### 2. Optimize — rewrite from the same underlying facts

AgentRank restructures the listing to raise it on those axes, plus 2–3
persona variants that reframe the same attributes toward different intents.

Two rules make the output safe for a brand to actually ship:

- **It never fabricates a verifiable claim.** No invented certifications, test
  results, review counts or prices. Where a fact is unknown and matters, it
  writes `[weight: confirm]` rather than guessing — a stated unknown is safer
  for an agent than a wrong number.
- **Every inference is surfaced** in a "needs brand verification" list.

The rewrite is then re-scored through the *identical* rubric. The improvement
has to survive the same judge, not a friendlier one.

### 3. Simulate — competitive, not self-graded

This is the part that makes the claim falsifiable.

For each shopper query, the target listing is placed in a pool with 3–4 rival
listings and an agent is asked to **rank all of them and pick one**. The same
query runs twice — once with the original content in the pool, once with the
optimized content — and nothing else changes.

Design choices that keep the number honest:

- **The rivals are strong.** They are generated to a high agent-ready standard
  on purpose. Beating weak strawmen would prove nothing.
- **The query bank includes queries this product should lose.** An evaluation
  a product cannot fail is not an evaluation.
- **Position is shuffled** per query and arm, seeded, because ranking models
  have real position bias — but the demo stays reproducible.
- **Rank metrics, not just win-rate.** On a 5-way race, win-rate is coarse.
  Mean rank and top-3 rate catch improvement that a flat win count hides.
- The agent is told to judge only on what each listing says, and to ignore
  outside brand knowledge.

Measured result on the bundled sample (12 queries × 5 listings, 24 agent
decisions):

| | Original | Optimized |
|---|---|---|
| Picked #1 | 1 / 12 | **3 / 12** |
| Made top 3 | 10 / 12 | **12 / 12** |
| Mean rank | 2.50 | **1.92** |

Readiness score over the same rewrite: **48 → 79**.

---

## How this maps to the judging rubric

**1. Problem comprehension.** The six dimensions are the thesis, not
decoration. The bundled sample is deliberately a listing that already contains
good facts — 238g, 8mm drop, 700km, S$179 — and still scores 48, because its
persona (18) and comparative (24) axes are empty. The diagnosis is *"your data
is fine, your framing isn't"*, which is the real gap for most catalogues and a
much more actionable finding than "add more detail".

**2. Solution architecture.** Score, optimize and simulate are three prompts
against one content model, kept in a single `lib/prompts.ts`. Simulation
streams NDJSON with bounded concurrency so a 24-call run fills in live instead
of hanging. Structured output is Zod-validated at every boundary.

**3. AI reasoning quality.** The simulation ranks a competitive pool rather
than asking yes/no about one product, so "does it surface the right product"
is measured directly. The UI shows the agent's actual reasoning for queries
that flipped — including the runner-up it rejected and why.

**4. Scalability & generalisability.** Nothing downstream knows what a running
shoe is. Category is inferred at scoring time; the query bank and competitor
set for *any* pasted product are generated at request time by
`/api/querybank`. The three category buttons are demo convenience only —
deleting `lib/presets.ts` would not break the pipeline.

**5. Brand adoptability.** Export is `schema.org/Product` JSON-LD with
structured attributes in `additionalProperty` and personas as
`PeopleAudience` — a block a brand pastes into an existing PDP template today,
which is already what agent crawlers read. No replatforming, no integration.
The natural commercial framing: run this before onboarding a catalogue onto a
conversational commerce platform, to find out which SKUs need content work
first.

---

## Layout

```
lib/dimensions.ts    the six axes, weights, rubrics
lib/prompts.ts       all three stages' prompts, one file
lib/schemas.ts       Zod contracts for every LLM boundary
lib/simulate.ts      trial runner, seeded shuffle, concurrency pool
lib/export.ts        schema.org JSON-LD emitter
lib/presets.ts       demo samples + hand-written query banks (optional)
lib/demo-data.json   a cached real run, for offline demoing
app/api/*            score / optimize / querybank / simulate
```

## Known limits

- Single product per run. Batch CSV is the obvious next step and the code is
  shaped for it — every stage already takes a plain `Product`.
- Competitor listings are LLM-generated rather than scraped from a real
  catalogue. That keeps the benchmark strong and category-agnostic, but a real
  deployment would rank against the brand's actual competitive set.
- Simulation results vary slightly run to run despite the seeded shuffle,
  since the model itself is not deterministic.
