# AgentRank

**Your product ranks #1 on Google. Where does it rank with an agent?**

*LifeHack NUS 2026 — Rezolve AI track*

Shoppers increasingly put constrained, intent-rich questions to AI agents —
*"lightweight shoes for a humid half-marathon under S$200"*. An agent can only
recommend a product it can reason about, and most catalogue content gives it
nothing to reason with. Good products get skipped, not because they are worse,
but because their content was written for humans who browse rather than agents
who reason.

AgentRank scores whether an agent could act on a listing, rewrites it so it
can, and then **proves the difference with a controlled ablation** rather than
asserting it.

```
raw catalogue text → [1 SCORE] → [2 OPTIMIZE] → [3 ABLATION] → measured proof
                                                      │
                                              [4 SHOPPER MODE]
                                        30-SKU catalogue, top-3 results
```

---

## Quick start

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

Open http://localhost:3000.

- **`Run the pipeline`** chains score → optimize → control → ablation in one
  click, streaming each of the 36 agent decisions into the UI as it lands.
  Individual stages can also be run one at a time.
- **`Shopper mode`** in the top nav is the consumer-facing benchmark.
- **<kbd>D</kbd>** replays a recorded end-to-end run of the current page with
  zero network calls — the fallback for when live API latency would sink a
  timed presentation. It is a keyboard shortcut rather than a button so the
  interface shows the product, not the presenter's machinery; the "live model
  run" indicator is never shown over a replay. Wait for the page to hydrate
  before pressing it.

Provider is auto-detected: `AI_GATEWAY_API_KEY` wins if present (Vercel AI
Gateway, any model by string id), otherwise `OPENAI_API_KEY` is used directly.
Models are overridable with `AGENT_MODEL`, `AGENT_FAST_MODEL`,
`AGENT_EMBED_MODEL`.

---

## Results

All numbers below are from real runs and are reproducible from the cached
fixtures in `lib/`.

### Readiness score

| | Original | Optimized |
|---|---|---|
| **Overall** | **48** | **79** |
| Use-case coverage | 42 | 88 |
| Persona relevance | 18 | 82 |
| Comparative framing | 24 | 76 |
| Attribute structure | 76 | 84 |
| Constraint answerability | 72 | 80 |
| Trust signal | 34 | 48 |

The shape matters more than the number. The sample listing already contains
good facts — 238 g, 8 mm drop, 700 km, S$179 — and still scores 48, because
persona (18) and comparative framing (24) are empty. **The brand's data is
fine; the framing is missing.** That is a far more actionable diagnosis than
"add more detail", and it is why the fix can be automated at all.

### The ablation — 12 queries × 5 listings × 3 arms = 36 agent decisions

| Content arm | Picked #1 | Recall@3 | MRR | Mean rank | Words |
|---|---|---|---|---|---|
| Raw catalogue | 2 / 12 | 0.75 | 0.447 | 2.83 | 84 |
| **Bloat control** | 0 / 12 | 0.67 | **0.353** | 3.17 | 491 |
| **AgentRank** | **5 / 12** | **1.00** | **0.694** | **1.67** | 608 |

**The bloat arm is the point.** LLM judges are known to prefer longer text
([Wang et al., ACL 2024](https://aclanthology.org/2024.acl-long.511/)), and the
rewrite *is* longer — so "did structure win, or did length?" is a fair
challenge. The control is the original padded to 5.8× its length with pure
marketing prose and zero new facts. It scores **worse than raw**, −21% MRR.
Length does not explain the +55% gain; it actively hurts. The claim survives.

### Shopper mode — 30-SKU catalogue, 4 shopper profiles

nDCG@3 against ESCI-style graded relevance labels:

| Shopper | Raw | Agent-ready | Δ |
|---|---|---|---|
| Budget beginner | 1.000 | 1.000 | ceiling |
| Humid half-marathon | 0.170 | 0.339 | **+0.169** |
| Heavier, wide feet | 1.000 | 0.922 | **−0.078** |
| Weekend trail | 0.823 | 1.000 | +0.177 |
| **Mean** | **0.748** | **0.815** | **+0.067** |

**One profile regresses, and it is reported rather than dropped.** Two sit at
ceiling because their binding constraint is price, which survives even in vague
copy — the arms separate exactly where the constraint is one that raw copy
tends to omit (breathability, terrain, fit). A benchmark you always win is not
a benchmark.

The two stages answer **different questions**, and the gap between +55% and
+9% is expected:

- **Ablation** — *my product is agent-ready, my competitors are not.* The
  individual brand's ROI.
- **Shopper mode** — *the entire catalogue is agent-ready.* The platform's ROI,
  i.e. what a retailer gains onboarding a whole catalogue.

---

## How it works

### 1. Score

Six axes, each judged by an LLM against a written rubric rather than keyword
presence. The question is always: *given only this text, could a reasoning
agent confidently recommend or reject this product for a specific constrained
question — and defend that answer?*

| Axis | Weight | Catches |
|---|---|---|
| Use-case coverage | 0.20 | "running shoe" vs "half-marathon training in humid climates" |
| Persona relevance | 0.15 | who it is for, and who it is *not* for |
| Comparative framing | 0.15 | can the agent reason "better than X for Y"? |
| Attribute structure | 0.20 | machine-parseable facts with units, not prose |
| Constraint answerability | 0.20 | price, sizes, capacity, allergens, compatibility |
| Trust signal | 0.10 | claims an agent is willing to cite |

Attributes and constraints carry the most weight because an agent that cannot
parse a spec or check a price ceiling drops the product before the softer
signals matter. Weights live in `lib/dimensions.ts`.

### 2. Optimize

Restructures the listing from the same underlying facts, plus 2–3 persona
variants reframing those attributes toward different intents.

Two rules make the output safe for a brand to actually ship:

- **It never fabricates a verifiable claim.** No invented certifications, test
  results, review counts or prices. Where a fact is unknown and matters, it
  writes `[weight: confirm]` rather than guessing — a stated unknown is safer
  for an agent than a wrong number.
- **Every inference is surfaced** in a "needs brand verification" list.

The rewrite is then re-scored through the *identical* rubric. The improvement
has to survive the same judge, not a friendlier one.

### 3. Ablation

For each shopper query the target listing joins a pool with 3–4 rivals and an
agent must **rank all of them and pick one**. Same query, same rivals, same
agent — only the target's content changes between arms.

Choices that keep the number honest:

- **The rivals are strong**, generated to a high agent-ready standard on
  purpose. Beating strawmen would prove nothing.
- **The query bank includes queries this product should lose.**
- **Position is shuffled** per query and arm, seeded — LLM rankers have
  documented position bias
  ([Hou et al., ECIR 2024](https://arxiv.org/abs/2305.08845)) — while staying
  reproducible.
- **Rank metrics, not just win-rate.** On a five-way race a single "was it
  picked" bit throws away most of the signal.
- The agent judges only on what each listing says and is told to ignore outside
  brand knowledge.

### 4. Shopper mode

Two-stage retrieval over a 30-product catalogue: embeddings shortlist 8, then
the LLM reranks to 3. **The model never sees the catalogue, only a shortlist** —
which is how this survives contact with 10,000 SKUs.

Ground truth cannot be gamed. Every product carries a hidden `facts` spec
sheet. A separate model grades relevance **E**xact / **S**ubstitute /
**C**omplement / **I**rrelevant from the facts alone, never from the marketing
copy under test. Ground truth therefore describes what a product *is*, so
rewriting how it is described cannot move the target.

Grading scheme follows the [Amazon Shopping Queries (ESCI)
dataset](https://arxiv.org/abs/2206.06588); the metric is
[nDCG](https://dl.acm.org/doi/10.1145/582415.582418).

---

## Judging-criteria alignment

**1 · Problem comprehension.** The six dimensions are the thesis, not
decoration. The bundled sample is deliberately a listing that already has good
data and still scores 48 — diagnosing a *framing* gap, not a data gap.

**2 · Solution architecture.** Score, optimize, bloat and rank are four prompts
against one content model, kept in a single `lib/prompts.ts`. The ablation
streams NDJSON with bounded concurrency so 36 calls fill in live. Every LLM
boundary is Zod-validated. Two model tiers: a reasoning model for single deep
calls, a fast model for the parallel ranking swarm.

**3 · AI reasoning quality.** The system ranks competitive pools rather than
asking yes/no about one product, so "does it surface the right product" is
measured directly. The UI shows the agent's actual reasoning for queries that
flipped, including the runner-up it rejected and why.

**4 · Scalability & generalisability.** Nothing downstream knows what a running
shoe is — category is inferred at scoring time, and the query bank and
competitor set for *any* pasted product are generated at request time by
`/api/querybank`. Deleting `lib/presets.ts` would not break the pipeline. The
embedding shortlist is the answer for catalogue scale.

**5 · Brand adoptability.** Export is `schema.org/Product` JSON-LD with
attributes in `additionalProperty` and personas as `PeopleAudience` — a block a
brand pastes into an existing PDP template today, which is already what agent
crawlers read. No replatform. The commercial wedge: run this *before*
onboarding a catalogue onto a conversational commerce platform, to find out
which SKUs need work first.

---

## Why now

The checkout rails for agentic commerce already shipped — OpenAI and Stripe's
ACP, [Google's AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol),
and Microsoft's [NLWeb](https://github.com/nlweb-ai/NLWeb) is making schema.org
the substrate agents query. The industry solved *how an agent pays*. Nobody
solved *whether the agent picks you*.

---

## Layout

```
lib/dimensions.ts      the six axes, weights, rubrics
lib/prompts.ts         every stage's prompt, one file
lib/schemas.ts         Zod contracts for each LLM boundary
lib/simulate.ts        trial runner, seeded shuffle, concurrency pool, metrics
lib/catalog.ts         catalogue types, ESCI labels, nDCG
lib/shoppers.ts        four hand-written shopper profiles
lib/export.ts          schema.org JSON-LD emitter
lib/presets.ts         demo samples + query banks (optional convenience)
lib/*-data.json        cached real runs, for offline demoing

app/api/score          rubric scoring
app/api/optimize       agent-ready rewrite + persona variants
app/api/bloat          length-matched control arm
app/api/querybank      category-agnostic query + competitor generation
app/api/simulate       N-arm ablation, NDJSON stream
app/api/shop           two-stage retrieval, top-3
app/api/relevance      ESCI ground-truth labelling

app/page.tsx           brand-facing pipeline
app/shop/page.tsx      shopper mode
app/components/ui.tsx      dials, delta bars, stat tiles, sections
app/components/chrome.tsx  nav, source badge, footer
app/components/RadarPanel.tsx  the six-axis radar
app/globals.css        design tokens: mint = agent-ready, amber = baseline,
                       red = control arm / regression
```

Stack: Next.js 16 (App Router), Vercel AI SDK v7, Zod, Recharts, Tailwind v4.

---

## Known limits

Stated plainly, because pretending they do not exist is worse than having them.

- **Single product per run** on the brand-facing pipeline. Batch CSV is the
  obvious next step and the code is shaped for it — every stage already takes a
  plain `Product`.
- **Competitors and the catalogue are LLM-generated**, not scraped from a real
  retailer. That keeps the benchmark strong and category-agnostic, but a real
  deployment would rank against the brand's actual competitive set. The
  [ESCI dataset](https://github.com/amazon-science/esci-data) — 130k real
  Amazon queries with 2.6M human relevance labels — is the upgrade path.
- **Relevance labels are LLM-graded, not human-graded.** Independent of the
  content under test, but not the same as human ground truth.
- **Results vary slightly run to run** despite the seeded shuffle, because the
  model itself is not deterministic. Bootstrapped multi-pass ranking (Hou et
  al.) would tighten this.
- **Shopper mode saturates** on price-constrained profiles. A harder profile
  set would separate the arms more cleanly.

## References

- [Shopping Queries Dataset (ESCI)](https://arxiv.org/abs/2206.06588) — Reddy et al., 2022 · [data](https://github.com/amazon-science/esci-data)
- [LLMs are Zero-Shot Rankers for Recommender Systems](https://arxiv.org/abs/2305.08845) — Hou et al., ECIR 2024 (position & popularity bias)
- [Large Language Models are not Fair Evaluators](https://aclanthology.org/2024.acl-long.511/) — Wang et al., ACL 2024 (verbosity bias)
- [Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) — Zheng et al., NeurIPS 2023
- [Is ChatGPT Good at Search? (RankGPT)](https://arxiv.org/abs/2304.09542) — Sun et al., EMNLP 2023
- [Cumulated gain-based evaluation of IR techniques](https://dl.acm.org/doi/10.1145/582415.582418) — Järvelin & Kekäläinen, 2002 (nDCG)
- [A Survey of Explanations in Recommender Systems](https://www.semanticscholar.org/paper/A-Survey-of-Explanations-in-Recommender-Systems-Tintarev-Masthoff/a253a4ede67b04f383d71dc60ffd91d9ac8782f7) — Tintarev & Masthoff, 2007
