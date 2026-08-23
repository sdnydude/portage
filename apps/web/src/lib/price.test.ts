import { describe, it, expect } from "vitest";
import { resolvePublishPrice, resolvePublishPriceWithSource, parsePriceInput } from "./price";

describe("parsePriceInput — price text field → number | null", () => {
  it("parses a positive decimal", () => {
    expect(parsePriceInput("129.99")).toBe(129.99);
  });
  it("returns null for empty, non-numeric, zero, or negative input", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
    expect(parsePriceInput("0")).toBeNull();
    expect(parsePriceInput("-5")).toBeNull();
  });
});

const base = { price: null, estimatedValueRecommended: undefined, estimatedValueMin: undefined };

describe("resolvePublishPrice — prefill precedence for the publish price field", () => {
  it("prefers the seller-set item price over everything", () => {
    expect(
      resolvePublishPrice(
        { ...base, price: 129.99, estimatedValueRecommended: 80 },
        { soldMedian: 95, activeMedian: 110 },
      ),
    ).toBe(129.99);
  });

  it("falls back to sold-median comps when no item price is set", () => {
    expect(
      resolvePublishPrice({ ...base, estimatedValueRecommended: 80 }, { soldMedian: 95, activeMedian: 110 }),
    ).toBe(95);
  });

  it("falls back to active-median when there is no sold-median", () => {
    expect(
      resolvePublishPrice({ ...base, estimatedValueRecommended: 80 }, { soldMedian: null, activeMedian: 110 }),
    ).toBe(110);
  });

  // Housekeeping-1 T4: the AI estimated-value range is retired — it never
  // prefills a price. item.price → comps → null.
  it("ignores the AI estimates even when no comps exist", () => {
    expect(resolvePublishPrice({ ...base, estimatedValueRecommended: 80, estimatedValueMin: 40 }, null)).toBeNull();
  });

  it("returns null when nothing is known", () => {
    expect(resolvePublishPrice(base)).toBeNull();
    expect(resolvePublishPrice(base, { soldMedian: null, activeMedian: null })).toBeNull();
  });

  it("treats a set price as authoritative even when comps are higher (no silent override)", () => {
    expect(resolvePublishPrice({ ...base, price: 50 }, { soldMedian: 200 })).toBe(50);
  });
});

describe("resolvePublishPriceWithSource — prefill price + provenance", () => {
  const base = { price: null, estimatedValueRecommended: null, estimatedValueMin: null };

  it("reports which precedence step the prefill came from", () => {
    expect(resolvePublishPriceWithSource({ ...base, price: 50 }, { soldMedian: 95 })).toEqual({ price: 50, source: "item" });
    expect(resolvePublishPriceWithSource(base, { soldMedian: 95 })).toEqual({ price: 95, source: "comps" });
    expect(resolvePublishPriceWithSource(base, { soldMedian: null, activeMedian: 110 })).toEqual({ price: 110, source: "comps" });
    expect(resolvePublishPriceWithSource({ ...base, estimatedValueRecommended: 80 }, null)).toEqual({ price: null, source: null });
    expect(resolvePublishPriceWithSource(base, null)).toEqual({ price: null, source: null });
  });
});
