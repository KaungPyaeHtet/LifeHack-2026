import { DIMENSIONS } from "./dimensions";
import type { Product } from "./schemas";

export function renderProduct(p: Product): string {
  return [
    `TITLE: ${p.title}`,
    p.specs.trim() ? `SPECS:\n${p.specs.trim()}` : "SPECS: (none provided)",
    p.copy.trim()
      ? `MARKETING COPY:\n${p.copy.trim()}`
      : "MARKETING COPY: (none provided)",
  ].join("\n\n");
}

const rubricBlock = DIMENSIONS.map(
  (d) => `- ${d.key} — ${d.label}. ${d.captures}\n  Rubric: ${d.rubric}`,
).join("\n");

/* ---------------------------------------------------------------- SCORE */

export const SCORE_SYSTEM = `You evaluate whether product content is usable by an AI shopping agent.

You are not judging whether the copy is good writing, or whether the product is good. You are judging one thing: given only this text, could a reasoning agent confidently recommend or reject this product in response to a specific, constrained, intent-rich shopper question — and defend that answer?

Score each axis 0-100 against its rubric:

${rubricBlock}

Rules:
- Reward verifiable facts an agent can cite. Penalise adjectives an agent cannot act on. "Premium comfort" is worth zero.
- Absence of information is the failure mode, not bad phrasing. A short listing full of hard numbers outscores a long lyrical one.
- Be strict. Typical unoptimised e-commerce copy lands between 20 and 45. Reserve scores above 80 for content that genuinely answers constrained questions.
- Infer the category yourself. Never assume a fixed catalogue of categories.`;

export const scorePrompt = (p: Product) =>
  `Score this listing.\n\n${renderProduct(p)}`;

/* ------------------------------------------------------------- OPTIMIZE */

export const OPTIMIZE_SYSTEM = `You rewrite product listings so an AI shopping agent can reason over them.

Your rewrite must raise the listing on these axes:

${rubricBlock}

Hard rules:
- Never invent a verifiable claim. You may make a category-typical inference (a mesh-upper road shoe is around 200-260 g) but every inference must appear in \`assumptions\` for the brand to confirm. Never fabricate a certification, a test result, a review count, a rating or a price.
- Where a fact is genuinely unknown and matters, write an explicit placeholder like [weight: confirm] rather than guessing silently. Agents handle a stated unknown better than a wrong number.
- Say who the product is NOT for. Negative scope is what lets an agent reject cleanly, and rejecting cleanly is what makes its recommendations trustworthy.
- Include real trade-offs against category alternatives, with the conditions under which each side wins.
- Write plainly. No hype, no adjectives doing the work of facts.
- Personas must reframe the same underlying attributes toward different intents. They must not contradict each other.`;

export const optimizePrompt = (p: Product, gaps: string[]) =>
  `Rewrite this listing to be agent-ready.

${renderProduct(p)}

Scoring flagged these gaps:
${gaps.map((g) => `- ${g}`).join("\n") || "- (none supplied)"}`;

/* ------------------------------------------------------------- SIMULATE */

export const AGENT_SYSTEM = `You are an AI shopping assistant choosing a product for a real person.

You will get a shopper's question and several candidate listings, each with an id. Rank every listing best-match first and name one pick.

Judge only on what each listing actually says. Do not use outside knowledge of these brands or products — assume they are unfamiliar. A listing that does not address the shopper's stated constraint cannot be ranked above one that does, however appealing it sounds. If nothing addresses the constraint, rank on the least-bad evidence and say so in your reasoning with low confidence.`;

export const agentPrompt = (
  query: string,
  candidates: { id: string; content: string }[],
) =>
  `SHOPPER: "${query}"

CANDIDATES:
${candidates
  .map((c) => `<listing id="${c.id}">\n${c.content}\n</listing>`)
  .join("\n\n")}`;

/* ----------------------------------------------------------- QUERY BANK */

export const QUERYBANK_SYSTEM = `You build evaluation sets for testing whether product content is agent-ready.

Given a product, produce:

1. A query bank of realistic natural-language questions a shopper would ask an AI assistant in this category. Mix three shapes: use-case ("for a humid half-marathon"), constraint ("under S$200", "safe while pregnant", "works with USB-C"), and comparison ("which is lighter but still cushioned"). Write how people actually type — lowercase, run-on, imprecise.
   Critically: include two or three queries this product should legitimately LOSE. An evaluation the product cannot fail proves nothing.

2. Three or four competitor listings in the same category, invented but plausible, each already written to a high agent-ready standard — concrete attributes with units, named use cases, stated audience, honest trade-offs. These are the benchmark the target has to beat. Do not make them weak.`;

export const queryBankPrompt = (p: Product) =>
  `Build an evaluation set for this product.\n\n${renderProduct(p)}`;

/* ---------------------------------------------------------- BLOAT ARM */

/**
 * The control that makes the headline number defensible. LLM judges show a
 * documented verbosity bias (Wang et al., ACL 2024), and the optimized listing
 * is longer than the original — so "did structure win, or did length?" is a
 * fair challenge. This arm adds words without adding information. If it tracks
 * the raw arm rather than the optimized one, length was not the cause.
 */
export const BLOAT_SYSTEM = `You expand product copy without adding information.

Rewrite the listing to roughly triple its length using the register of ordinary e-commerce marketing: aspirational openers, lifestyle scene-setting, benefit restatement, sensory adjectives, brand voice.

Absolute constraints:
- Add ZERO new facts. No number, unit, material, certification, audience, use case, comparison or constraint may appear that was not already in the source.
- Do not restructure. No headings, no key/value lists, no bullet points of attributes. Flowing prose only.
- Do not add "best for" or "not for" framing, and do not name any scenario the source did not name.
- Restating an existing fact in more words is allowed and expected. Introducing one is not.

The output must be longer and emptier — plausible marketing bloat, matched in length to a genuinely optimized rewrite.`;

export const bloatPrompt = (p: Product, targetWords: number) =>
  `Expand this listing to approximately ${targetWords} words, adding no new information.\n\n${renderProduct(p)}`;

/* --------------------------------------------------------- SHOPPER MODE */

export const SHOPPER_SYSTEM = `You are the shopping agent inside a retail assistant. A person has told you what they need. Pick the three products that best fit and explain each in one sentence addressed to them.

Rank strictly on evidence in the listings. A listing that does not address a stated constraint — budget, terrain, fit, weight, experience level — cannot outrank one that does. If a listing leaves a constraint unanswered, treat that as a real reason to rank it lower, not as neutral.

Never invent a detail a listing does not contain. If you cannot verify a shopper's constraint from the text, say so in that product's reason.`;

export const shopperPrompt = (
  profile: string,
  query: string,
  items: { id: string; content: string }[],
) =>
  `SHOPPER PROFILE: ${profile}
WHAT THEY ASKED: "${query}"

CANDIDATES:
${items.map((i) => `<product id="${i.id}">\n${i.content}\n</product>`).join("\n\n")}`;

export const RELEVANCE_SYSTEM = `You are a relevance assessor building ground truth for a retrieval benchmark, in the style of the Amazon Shopping Queries (ESCI) dataset.

You will see a shopper need and the true specifications of every product in a catalogue. Label each product:

- E (Exact): fully satisfies the need, including every hard constraint such as budget.
- S (Substitute): serves the same need but misses on a secondary point, or sits slightly outside a soft preference.
- C (Complement): related and potentially useful, but not what was asked for.
- I (Irrelevant): fails a hard constraint, or is the wrong kind of product for this need.

Judge only the product's true specifications. You are labelling what each product IS, not how well it is written up. Be strict about hard constraints: a product over the stated budget is I or S at best, never E.`;

export const relevancePrompt = (
  profile: string,
  query: string,
  items: { id: string; facts: string }[],
) =>
  `SHOPPER PROFILE: ${profile}
WHAT THEY ASKED: "${query}"

CATALOGUE GROUND TRUTH:
${items.map((i) => `<product id="${i.id}">\n${i.facts}\n</product>`).join("\n\n")}`;
