import { describe, it, expect } from "vitest";
import type { Item } from "@/hooks/use-items";
import {
  itemToEditFields,
  buildItemUpdate,
  hasItemChanges,
  canSaveItemEdit,
} from "./item-edit";

const baseItem: Item = {
  id: "1",
  userId: "u1",
  title: "Vintage Camera",
  description: "A nice camera",
  category: "electronics",
  condition: "good",
  conditionNotes: "minor wear",
  brand: "Canon",
  model: "AE-1",
  features: [],
  photos: [],
  estimatedValueMin: null,
  estimatedValueMax: null,
  estimatedValueRecommended: null,
  aiConfidenceScore: 0,
  quantity: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("itemToEditFields", () => {
  it("extracts the eight editable fields from an item", () => {
    expect(itemToEditFields(baseItem)).toEqual({
      title: "Vintage Camera",
      description: "A nice camera",
      category: "electronics",
      condition: "good",
      conditionNotes: "minor wear",
      brand: "Canon",
      model: "AE-1",
      quantity: 1,
    });
  });
});

describe("buildItemUpdate", () => {
  it("trims free-text fields and passes through enums and quantity", () => {
    const result = buildItemUpdate({
      title: "  Padded Title  ",
      description: "  desc  ",
      category: "electronics",
      condition: "good",
      conditionNotes: "  notes  ",
      brand: "  Canon  ",
      model: "  AE-1  ",
      quantity: 3,
    });
    expect(result).toEqual({
      title: "Padded Title",
      description: "desc",
      category: "electronics",
      condition: "good",
      conditionNotes: "notes",
      brand: "Canon",
      model: "AE-1",
      quantity: 3,
    });
  });
});

describe("hasItemChanges", () => {
  it("is false when fields match the item", () => {
    expect(hasItemChanges(itemToEditFields(baseItem), baseItem)).toBe(false);
  });

  it("is true when any field differs", () => {
    const fields = { ...itemToEditFields(baseItem), condition: "fair" };
    expect(hasItemChanges(fields, baseItem)).toBe(true);
  });

  it("treats a quantity change as a change", () => {
    const fields = { ...itemToEditFields(baseItem), quantity: 5 };
    expect(hasItemChanges(fields, baseItem)).toBe(true);
  });
});

describe("canSaveItemEdit", () => {
  it("is false with no changes", () => {
    expect(canSaveItemEdit(itemToEditFields(baseItem), baseItem)).toBe(false);
  });

  it("is false when title is blank even if other fields changed", () => {
    const fields = { ...itemToEditFields(baseItem), title: "   ", brand: "Nikon" };
    expect(canSaveItemEdit(fields, baseItem)).toBe(false);
  });

  it("is true with a valid title and a real change", () => {
    const fields = { ...itemToEditFields(baseItem), brand: "Nikon" };
    expect(canSaveItemEdit(fields, baseItem)).toBe(true);
  });
});
