import { describe, it, expect } from "vitest";
import { buildListingPayload, type ScanListingInput } from "./scan-listing-payload";

const baseInput: ScanListingInput = {
  itemId: "item-1",
  price: 49.99,
  resolvedCategoryId: "33034",
  aspects: { Brand: ["Fender"] },
};

describe("buildListingPayload", () => {
  it("defaults to draft publishMode when the seller profile is null", () => {
    expect(buildListingPayload(baseInput, null)).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "draft",
    });
  });

  it("live mode carries categoryId and aspects in marketplaceSpecificFields", () => {
    expect(buildListingPayload(baseInput, { ebayPublishMode: "live" })).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("live with unresolved category carries aspects only — no categoryId key", () => {
    expect(
      buildListingPayload(
        { ...baseInput, resolvedCategoryId: null },
        { ebayPublishMode: "live" },
      ),
    ).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: { aspects: { Brand: ["Fender"] } },
    });
  });

  it("drops aspect entries whose values are empty or whitespace-only strings", () => {
    expect(
      buildListingPayload(
        {
          ...baseInput,
          aspects: { Brand: ["Fender"], Color: ["", "   "], Type: [] },
        },
        { ebayPublishMode: "live" },
      ),
    ).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "live",
      marketplaceSpecificFields: {
        categoryId: "33034",
        aspects: { Brand: ["Fender"] },
      },
    });
  });

  it("uses draft publishMode when the profile says draft", () => {
    expect(buildListingPayload(baseInput, { ebayPublishMode: "draft" })).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      price: 49.99,
      publishMode: "draft",
    });
  });

  it("draft payload has NO marketplaceSpecificFields key", () => {
    const payload = buildListingPayload(baseInput, { ebayPublishMode: "draft" });
    expect("marketplaceSpecificFields" in payload).toBe(false);
  });

  it("omits price when null", () => {
    expect(buildListingPayload({ ...baseInput, price: null }, null)).toEqual({
      itemId: "item-1",
      marketplace: "ebay",
      publishMode: "draft",
    });
  });
});
