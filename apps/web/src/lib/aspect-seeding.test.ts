import { describe, it, expect } from "vitest";
import type { RequiredAspect } from "@/hooks/use-required-aspects";
import { suggestAspectValues, mergeAspectSuggestions, autoFillFromAi } from "./aspect-seeding";

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

describe("mergeAspectSuggestions", () => {
  it("surfaces an AI-filled aspect as a suggestion and flags it AI-sourced", () => {
    const result = mergeAspectSuggestions(
      { Color: ["Red"] }, // aiAspects (Phase A candidate.aspects)
      {}, // seeded (no text match)
      { Color: aspect(["Red", "Blue"]) }, // required aspects schema
      {}, // aspectValues (nothing confirmed)
    );
    expect(result.suggestions).toEqual({ Color: ["Red"] });
    expect(result.aiNames).toEqual(["Color"]);
  });

  it("treats a malformed (non-array) AI aspect value as empty instead of crashing", () => {
    // The server validates candidate.aspects as string[], but a defensive guard
    // ensures a malformed value (e.g. a scalar) never reaches .filter and throws.
    // The malformed AI value is ignored; the deterministic seed fills the gap.
    const result = mergeAspectSuggestions(
      { Color: "Red" } as unknown as Record<string, string[]>, // malformed: scalar, not string[]
      { Color: ["Blue"] }, // seeded fallback
      { Color: aspect(["Red", "Blue"]) },
      {},
    );
    expect(result.suggestions).toEqual({ Color: ["Blue"] });
    expect(result.aiNames).toEqual([]);
  });

  it("fills an AI value for a schema aspect and flags it AI-sourced", () => {
    const result = autoFillFromAi(
      { Color: ["Red"] },
      { Color: aspect(["Red", "Blue"]) },
      {},
    );
    expect(result.values).toEqual({ Color: "Red" });
    expect(result.aiNames).toEqual(["Color"]);
  });

  it("does not auto-fill an AI value that is not in an enumerated aspect's allowed list", () => {
    const result = autoFillFromAi(
      { Color: ["Purple"] }, // not an allowed value
      { Color: aspect(["Red", "Blue"]) }, // enumerated
      {},
    );
    expect(result.values).toEqual({});
    expect(result.aiNames).toEqual([]);
  });

  it("never clobbers an aspect that already has a value (seller- or seed-set)", () => {
    const result = autoFillFromAi(
      { Brand: ["Sony"] },
      { Brand: aspect(["Sony"]) },
      { Brand: "Bose" }, // already set — AI must not overwrite
    );
    expect(result.values).toEqual({});
    expect(result.aiNames).toEqual([]);
  });

  it("ignores a malformed (non-array) AI value instead of filling it", () => {
    const result = autoFillFromAi(
      { Color: "Red" } as unknown as Record<string, string[]>,
      { Color: aspect(["Red"]) },
      {},
    );
    expect(result.values).toEqual({});
  });

  it("prefers AI over a text-matched seed and skips already-confirmed aspects", () => {
    const result = mergeAspectSuggestions(
      { Brand: ["Sony"], Color: ["Red"] },
      { Brand: ["Sany"], Type: ["Headphones"] }, // seeded; Brand also seeded (AI wins)
      { Brand: aspect(["Sony"]), Color: aspect(["Red"]), Type: aspect(["Headphones"]) },
      { Color: "Red" }, // Color already confirmed → excluded
    );
    expect(result.suggestions).toEqual({ Brand: ["Sony"], Type: ["Headphones"] });
    expect(result.aiNames).toEqual(["Brand"]);
  });
});
