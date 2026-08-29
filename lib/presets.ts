export type CategoryKey = "running-shoes" | "skincare" | "electronics";

export interface Category {
  key: CategoryKey;
  label: string;
  /**
   * Hand-written query bank. Realistic intent-rich questions a shopper would
   * put to an AI agent — deliberately a mix of use-case, constraint and
   * comparison shapes, and deliberately including queries this product should
   * NOT win, so a 50/50 result is meaningful rather than flattering.
   */
  queries: string[];
  sample: ProductInput;
}

export interface ProductInput {
  title: string;
  specs: string;
  copy: string;
}

export const CATEGORIES: Category[] = [
  {
    key: "running-shoes",
    label: "Running shoes",
    queries: [
      "lightweight running shoes for a humid half-marathon under S$200",
      "I'm a beginner runner with flat feet, what shoe should I start with?",
      "best shoe for marathon training in hot weather that won't give me blisters",
      "I need a running shoe I can also wear to the gym for lifting",
      "shoes under S$150 for someone running 5k three times a week",
      "which running shoe is more breathable for tropical climates?",
      "I run on trails and gravel — what should I get?",
      "wide-fit running shoes for a heavier runner who needs cushioning",
      "what's a good race-day shoe that isn't a carbon plate super shoe?",
      "I want a durable daily trainer that lasts over 800km",
      "vegan running shoes made from recycled materials",
      "recommend a shoe for treadmill running in an air-conditioned gym",
      "I'm training for my first 10k and my knees hurt on hard pavement",
      "waterproof running shoes for rainy season commuting",
      "which shoe is lighter but still cushioned enough for long runs?",
      "running shoe with a wide toe box for bunions",
    ],
    sample: {
      title: "Aerolite Pace 3 Running Shoe",
      specs: [
        "- Engineered mesh upper",
        "- EVA midsole with rubber outsole",
        "- Available in black, white, blue",
        "- UK 5-13 (men's), UK 3-9 (women's)",
        "- S$179",
      ].join("\n"),
      copy: "Push your limits with the Aerolite Pace 3. Weighing 238g with an 8mm drop, it delivers the responsive ride you have been waiting for. The open-weave upper was reworked this season and the outsole compound is rated to 700km. Engineered for performance and built to last. Feel the difference from your very first stride.",
    },
  },
  {
    key: "skincare",
    label: "Skincare",
    queries: [
      "gentle vitamin C serum for sensitive skin that won't cause redness",
      "what should I use for hyperpigmentation if I'm also on tretinoin?",
      "affordable brightening serum under S$60 for oily acne-prone skin",
      "fragrance-free serum safe to use while pregnant",
      "can I use this in the morning under sunscreen?",
      "I'm in my 20s and want a preventative anti-ageing product",
      "serum for dull skin in a humid climate that doesn't feel sticky",
      "what's better for dark spots — vitamin C or niacinamide?",
      "reef-safe and cruelty-free skincare brands",
      "I have rosacea, is a vitamin C serum going to irritate me?",
      "beginner-friendly serum for someone with no routine yet",
      "which serum has clinical evidence behind its claims?",
      "something that layers well with hyaluronic acid and retinol",
      "I want a serum in glass packaging that's refillable",
      "skincare for combination skin that's oily in the T-zone",
      "does this expire quickly once opened?",
    ],
    sample: {
      title: "GlowLab Radiance Serum",
      specs: [
        "- 30ml amber glass bottle",
        "- Contains vitamin C",
        "- Dermatologist tested",
        "- Made in Korea",
        "- S$48",
      ].join("\n"),
      copy: "Unlock your skin's natural radiance. Our advanced formula pairs 10% sodium ascorbyl phosphate with 2% niacinamide and hyaluronic acid in a fragrance-free base at pH 6.5. In an eight-week study with 42 participants, 78% reported visibly reduced dark spots. Lightweight and non-greasy, it absorbs in seconds. Wake up glowing, every single day.",
    },
  },
  {
    key: "electronics",
    label: "Electronics",
    queries: [
      "noise cancelling headphones for a 13-hour flight under S$400",
      "best headphones for open-plan office calls with good mic quality",
      "I wear glasses — which over-ear headphones won't hurt my temples?",
      "headphones with long battery life I can forget to charge",
      "can I connect these to both my laptop and phone at the same time?",
      "lightweight headphones for daily MRT commuting in Singapore",
      "which is better for gym workouts, these or earbuds?",
      "audiophile headphones for critical listening at home",
      "headphones for a kid with a volume limit",
      "do these work wired if the battery dies?",
      "budget noise cancelling under S$200",
      "headphones that fold flat for travel in a carry-on",
      "which headphones have the best noise cancelling for aeroplane engine noise?",
      "something comfortable enough for 8 hours of studying",
      "headphones with replaceable ear pads so they last years",
      "does it support high-res audio codecs on Android?",
    ],
    sample: {
      title: "SonicWave X700 Wireless Headphones",
      specs: [
        "- Bluetooth 5.3, multipoint",
        "- Hybrid active noise cancellation",
        "- USB-C charging",
        "- Foldable design",
        "- Black / silver",
        "- S$329",
      ].join("\n"),
      copy: "Immerse yourself in pure sound. The X700 runs 38 hours with ANC on, 55 with it off, and a 10-minute charge returns 5 hours. It weighs 254g, uses memory-foam pads with replaceable cushions, and folds into a 22cm case. LDAC and AAC supported. A 3.5mm cable is included. Premium comfort meets flagship audio in a design that goes everywhere with you.",
    },
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;
