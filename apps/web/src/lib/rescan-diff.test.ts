import { describe, it, expect } from "vitest";
import { diffRescan, buildRescanPatch } from "./rescan-diff";
import type { RecognitionCandidate } from "@portage/shared";

const candidate: RecognitionCandidate = {
  name: "Canon AE-1 Program",
  description: "d",
  category: "electronics",
  condition: "good",
  conditionNotes: "",
  brand: "Canon",
  model: "AE-1",
  features: [],
  estimatedValueLow: 0,
  estimatedValueHigh: 0,
  confidence: 0.9,
};

const item = {
  title: "Canon AE-1",
  description: "d",
  condition: "good",
  conditionNotes: "",
  brand: "Canon",
  model: "AE-1",
  features: [] as string[],
  aspects: {} as Record<string, string[]>,
};

describe("diffRescan", () => {
  it("emits one unselected row for a differing title when the seller already has one", () => {
    const rows = diffRescan(item, candidate);
    expect(rows).toEqual([
      { key: "title", label: "Title", current: "Canon AE-1", next: "Canon AE-1 Program", selected: false },
    ]);
  });

  it("pre-selects a row when the seller's field is empty, across every scalar field", () => {
    const blank = { ...item, title: "", description: "", conditionNotes: "", brand: "", model: "" };
    const full = { ...candidate, name: "N", description: "D", category: "C", condition: "fair" as const, conditionNotes: "CN", brand: "B", model: "M" };
    const rows = diffRescan({ ...blank, condition: "good" }, full);
    expect(rows.map((r) => [r.key, r.selected])).toEqual([
      ["title", true],
      ["description", true],
      ["condition", false],
      ["conditionNotes", true],
      ["brand", true],
      ["model", true],
    ]);
  });

  // Reviewer 2026-09-13: item.category holds the resolved eBay leaf name
  // ("Electric Guitars"); candidate.category is the vision model's coarse
  // bucket ("music"). They are never comparable, so no category row — the
  // scan's coarse category rides along in marketplaceData.scan instead.
  it("never emits a category row, even when the leaf name and the coarse bucket differ", () => {
    // The item's leaf name ("Electric Guitars") is not even part of the diff input.
    const rows = diffRescan(
      { ...item, title: candidate.name },
      { ...candidate, category: "music" },
    );
    expect(rows.find((r) => r.key === "category")).toBeUndefined();
  });

  it("emits one row per differing aspect key, omitting keys the scan agrees on", () => {
    const rows = diffRescan(
      { ...item, title: candidate.name, aspects: { Brand: ["Canon"], Type: ["SLR"] } },
      { ...candidate, aspects: { Brand: ["Canon"], Type: ["Rangefinder"], "Film Format": ["35 mm"] } },
    );
    expect(rows).toEqual([
      { key: "aspect:Type", label: "Type", current: "SLR", next: "Rangefinder", selected: false },
      { key: "aspect:Film Format", label: "Film Format", current: "", next: "35 mm", selected: true },
    ]);
  });

  it("emits a features row as a comma list, unselected when the item already has features", () => {
    const rows = diffRescan(
      { ...item, title: candidate.name, features: ["Manual focus"] },
      { ...candidate, features: ["Manual focus", "Program mode"] },
    );
    expect(rows).toEqual([
      { key: "features", label: "Features", current: "Manual focus", next: "Manual focus, Program mode", selected: false },
    ]);
  });
});

describe("buildRescanPatch", () => {
  it("emits only the selected fields, aspects nested by name, plus scan provenance", () => {
    const provenance = { identification: { provider: "gemini", model: "gemini-3.8-flash" } };
    const patch = buildRescanPatch(
      ["title", "brand", "features", "aspect:Type"],
      { ...candidate, features: ["A"], aspects: { Type: ["Rangefinder"], Brand: ["Canon"] } },
      provenance,
    );
    expect(patch).toEqual({
      title: "Canon AE-1 Program",
      brand: "Canon",
      features: ["A"],
      aspects: { Type: ["Rangefinder"] },
      marketplaceData: { scan: { visionCategory: "electronics", provenance } },
    });
  });
});
