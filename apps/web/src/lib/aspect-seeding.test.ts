import { describe, it, expect } from "vitest";
import type { RequiredAspect } from "@/hooks/use-required-aspects";
import { suggestAspectValues } from "./aspect-seeding";

const aspect = (values: string[] | null, required = true): RequiredAspect => ({
  required,
  values,
});

describe("suggestAspectValues", () => {
  it("suggests an enumerated value literally present in the item text", () => {
    expect(
      suggestAspectValues("Fender Stratocaster electric guitar", {
        Brand: aspect(["Fender", "Gibson"]),
      }),
    ).toEqual({ Brand: ["Fender"] });
  });

  it("word-boundary: 'Shredder' must not yield 'Red'", () => {
    expect(
      suggestAspectValues("Shredder for office paper", {
        Color: aspect(["Red", "Blue"]),
      }),
    ).toEqual({});
  });

  it("matches multi-word enumerated values across spaces", () => {
    expect(
      suggestAspectValues("Vintage solid body electric guitar", {
        "Body Type": aspect(["Solid Body", "Hollow Body"]),
      }),
    ).toEqual({ "Body Type": ["Solid Body"] });
  });

  it("collects ALL matching values for an aspect", () => {
    expect(
      suggestAspectValues("Black and white checkered strap", {
        Color: aspect(["Black", "White", "Red"]),
      }),
    ).toEqual({ Color: ["Black", "White"] });
  });

  it("ignores free-text aspects (values: null) even when text would match", () => {
    expect(
      suggestAspectValues("Fender Stratocaster", {
        Brand: aspect(null),
      }),
    ).toEqual({});
  });

  it("matches case-insensitively but returns eBay's canonical casing", () => {
    expect(
      suggestAspectValues("FENDER stratocaster", {
        Brand: aspect(["Fender"]),
      }),
    ).toEqual({ Brand: ["Fender"] });
  });

  it("handles regex-special characters in enumerated values safely (e.g. 'A+')", () => {
    expect(
      suggestAspectValues("Graded A+ condition card", {
        Grade: aspect(["A+", "B"]),
      }),
    ).toEqual({ Grade: ["A+"] });
  });

  it("returns {} for empty or whitespace-only item text", () => {
    expect(suggestAspectValues("   ", { Brand: aspect(["Fender"]) })).toEqual({});
  });
});
