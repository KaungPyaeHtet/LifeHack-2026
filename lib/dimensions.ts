export type DimensionKey =
  | "useCase"
  | "persona"
  | "comparative"
  | "attributes"
  | "constraints"
  | "trust";

export interface Dimension {
  key: DimensionKey;
  label: string;
  short: string;
  weight: number;
  captures: string;
  rubric: string;
}

/**
 * The six axes a shopping agent actually reasons over. Weights sum to 1.
 * Constraint answerability and attribute structure are weighted highest:
 * an agent that can't parse a spec or check a price ceiling drops the
 * product before any of the softer signals matter.
 */
export const DIMENSIONS: Dimension[] = [
  {
    key: "useCase",
    label: "Use-case coverage",
    short: "Use case",
    weight: 0.2,
    captures: "Does the content name specific scenarios and contexts of use?",
    rubric:
      "100 = names several concrete situations, environments and activities the product is for (e.g. 'half-marathon training in humid climates', 'checked-bag-free weekend trips'). 50 = generic category use only ('for running'). 0 = no usage context at all.",
  },
  {
    key: "persona",
    label: "Persona relevance",
    short: "Persona",
    weight: 0.15,
    captures: "Does it address who it is for, not just what it is?",
    rubric:
      "100 = explicitly addresses skill level, body/skin type, experience, budget tier or life stage, and says who it is NOT for. 50 = one vague audience mention. 0 = product described with no audience.",
  },
  {
    key: "comparative",
    label: "Comparative framing",
    short: "Comparative",
    weight: 0.15,
    captures: "Can the agent reason 'better than X for Y'?",
    rubric:
      "100 = explicit trade-offs against alternatives or sibling models ('lighter but less cushioned than the Pro'), with the conditions under which each wins. 50 = vague superlatives ('best in class'). 0 = no comparison or trade-off language.",
  },
  {
    key: "attributes",
    label: "Attribute structure",
    short: "Attributes",
    weight: 0.2,
    captures: "Are specs machine-parseable rather than buried in prose?",
    rubric:
      "100 = key attributes appear as explicit labelled key/value facts with units (weight 212 g, drop 8 mm, sizes UK 5-13, material recycled nylon). 50 = specs present but only inside marketing sentences. 0 = no concrete numbers or units.",
  },
  {
    key: "constraints",
    label: "Constraint answerability",
    short: "Constraints",
    weight: 0.2,
    captures:
      "Can it answer explicit constraints — price ceiling, time limit, allergy, size, compatibility?",
    rubric:
      "100 = states price or price positioning, plus the hard constraints buyers filter on (sizes, capacity, battery life, allergens, compatibility, warranty). 50 = one or two constraint facts. 0 = an agent cannot verify any stated constraint.",
  },
  {
    key: "trust",
    label: "Trust & storytelling signal",
    short: "Trust",
    weight: 0.1,
    captures: "Verifiable claims an agent is willing to cite",
    rubric:
      "100 = specific, attributable evidence: test results, certifications, review counts and ratings, materials provenance, guarantees. 50 = unattributed claims ('loved by runners'). 0 = pure marketing adjectives.",
  },
];

export const DIMENSION_MAP = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d]),
) as Record<DimensionKey, Dimension>;

export function weightedScore(scores: Record<DimensionKey, number>): number {
  const total = DIMENSIONS.reduce(
    (sum, d) => sum + (scores[d.key] ?? 0) * d.weight,
    0,
  );
  return Math.round(total);
}

export function band(score: number): "red" | "amber" | "green" {
  if (score >= 75) return "green";
  if (score >= 45) return "amber";
  return "red";
}
