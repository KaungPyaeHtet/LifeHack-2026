import type { OptimizeResult, Product } from "./schemas";

/**
 * The integration pathway. A brand does not adopt a score — it adopts a block
 * it can paste into a PDP template. schema.org/Product is what agent crawlers
 * already read, and `additionalProperty` is where the structured attributes
 * that scoring rewards actually land.
 */
export function toJsonLd(product: Product, opt: OptimizeResult) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: firstParagraph(opt.optimized),
    additionalProperty: opt.attributes.map((a) => ({
      "@type": "PropertyValue",
      name: a.name,
      value: a.value,
    })),
    audience: opt.personas.map((p) => ({
      "@type": "PeopleAudience",
      audienceType: p.persona,
      description: p.intent,
    })),
  };
}

function firstParagraph(markdown: string): string {
  const body = markdown
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .join(" ");
  return body.slice(0, 500).trim();
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
