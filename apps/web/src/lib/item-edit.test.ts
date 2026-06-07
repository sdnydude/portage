import { describe, it, expect } from "vitest";
import type { Item } from "@/hooks/use-items";
import {
  itemToEditFields,
  buildItemUpdate,
  hasItemChanges,
  canSaveItemEdit,
  type ItemEditFields,
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

const baseFields: ItemEditFields = {
  title: "Vintage Camera",
  description: "A nice camera",
  category: "electronics",
  condition: "good",
  conditionNotes: "minor wear",
  brand: "Canon",
  model: "AE-1",
  quantity: 1,
  weight: null,
  dimLength: null,
  dimWidth: null,
  dimHeight: null,
  ebayPackageType: null,
  weightEstimated: false,
};

describe("itemToEditFields", () => {
  it("extracts the editable fields, weight absent on a weightless item", () => {
    expect(itemToEditFields(baseItem)).toEqual(baseFields);
  });

  it("converts the stored weight (ounces) to decimal pounds", () => {
    const withWeight: Item = {
      ...baseItem,
      weightOz: 40, lengthIn: 10, widthIn: 8, heightIn: 4,
      ebayPackageType: "MAILING_BOX", weightEstimated: true,
    };
    expect(itemToEditFields(withWeight)).toMatchObject({
      weight: 2.5, dimLength: 10, dimWidth: 8, dimHeight: 4,
      ebayPackageType: "MAILING_BOX", weightEstimated: true,
    });
  });
});

describe("buildItemUpdate", () => {
  it("trims free-text fields and omits weight when absent", () => {
    const result = buildItemUpdate({
      ...baseFields,
      title: "  Padded Title  ",
      description: "  desc  ",
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
      weightEstimated: false,
      weightOz: undefined,
      lengthIn: undefined,
      widthIn: undefined,
      heightIn: undefined,
      ebayPackageType: undefined,
    });
  });

  it("normalizes decimal pounds to a positive integer ounces", () => {
    const result = buildItemUpdate({
      ...baseFields, weight: 2.5, dimLength: 10, dimWidth: 8, dimHeight: 4,
      ebayPackageType: "MAILING_BOX", weightEstimated: true,
    });
    expect(result.weightOz).toBe(40);
    expect(result.lengthIn).toBe(10);
    expect(result.ebayPackageType).toBe("MAILING_BOX");
    expect(result.weightEstimated).toBe(true);
  });

  it("omits weightOz when weight rounds to zero ounces", () => {
    const result = buildItemUpdate({ ...baseFields, weight: 0.02 });
    expect(result.weightOz).toBeUndefined();
  });
});

describe("hasItemChanges", () => {
  it("is false when fields match the item", () => {
    expect(hasItemChanges(itemToEditFields(baseItem), baseItem)).toBe(false);
  });

  it("is true when any text field differs", () => {
    expect(hasItemChanges({ ...baseFields, condition: "fair" }, baseItem)).toBe(true);
  });

  it("treats a quantity change as a change", () => {
    expect(hasItemChanges({ ...baseFields, quantity: 5 }, baseItem)).toBe(true);
  });

  it("treats a weight or dimension change as a change", () => {
    expect(hasItemChanges({ ...baseFields, weight: 2 }, baseItem)).toBe(true);
    expect(hasItemChanges({ ...baseFields, dimLength: 10 }, baseItem)).toBe(true);
    expect(hasItemChanges({ ...baseFields, ebayPackageType: "LETTER" }, baseItem)).toBe(true);
  });
});

describe("canSaveItemEdit", () => {
  it("is false with no changes", () => {
    expect(canSaveItemEdit(itemToEditFields(baseItem), baseItem)).toBe(false);
  });

  it("is false when title is blank even if other fields changed", () => {
    expect(canSaveItemEdit({ ...baseFields, title: "   ", brand: "Nikon" }, baseItem)).toBe(false);
  });

  it("is true with a valid title and a real change", () => {
    expect(canSaveItemEdit({ ...baseFields, brand: "Nikon" }, baseItem)).toBe(true);
  });
});
