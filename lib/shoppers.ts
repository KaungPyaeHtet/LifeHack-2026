import type { Shopper } from "./catalog";

/**
 * Hand-written rather than generated. Each one carries at least one hard
 * constraint (a budget, a fit, a terrain) that a listing either answers or
 * does not — soft preference-only profiles cannot separate the arms.
 */
export const SHOPPERS: Shopper[] = [
  {
    id: "budget-beginner",
    label: "Budget beginner",
    profile:
      "New to running. Goes 3 times a week on pavement, 3-5 km. Normal width feet. Hard budget of S$100.",
    query: "i just started running, need a comfy shoe under S$100 for pavement",
  },
  {
    id: "humid-half",
    label: "Humid half-marathon",
    profile:
      "Training for a half marathon in Singapore. Runs 40 km a week in heat and humidity. Wants light. Budget up to S$200.",
    query:
      "lightweight shoes for a humid half-marathon, my feet get really hot, under S$200",
  },
  {
    id: "heavy-wide",
    label: "Heavier, wide feet",
    profile:
      "95 kg runner with wide feet and knee sensitivity. Runs 5 km three times a week on hard pavement. Budget flexible to S$220.",
    query: "wide fit cushioned shoe, i'm heavier and my knees hurt on concrete",
  },
  {
    id: "trail",
    label: "Weekend trail",
    profile:
      "Runs gravel and muddy trails at weekends, 10-15 km. Wants grip and protection. Budget up to S$260.",
    query: "something for muddy gravel trails with proper grip",
  },
];
