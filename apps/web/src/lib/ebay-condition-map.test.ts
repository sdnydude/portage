import { describe, it, expect } from "vitest";
import {
  getAvailablePortageConditions,
  ALL_PORTAGE_CONDITIONS,
} from "./ebay-condition-map";

describe("getAvailablePortageConditions", () => {
  it("returns all five Portage conditions when conditionIds is empty (fail-open)", () => {
    expect(getAvailablePortageConditions([])).toEqual([
      "new",
      "like_new",
      "good",
      "fair",
      "poor",
    ]);
    expect(ALL_PORTAGE_CONDITIONS).toEqual([
      "new",
      "like_new",
      "good",
      "fair",
      "poor",
    ]);
  });

  it("returns only 'new' when the category supports just conditionId 1000", () => {
    expect(getAvailablePortageConditions(["1000"])).toEqual(["new"]);
  });

  it("returns every condition whose chain contains 3000 (like_new/good/fair/poor)", () => {
    expect(getAvailablePortageConditions(["3000"])).toEqual([
      "like_new",
      "good",
      "fair",
      "poor",
    ]);
  });

  it("returns [] for unrecognized conditionIds only — UI must warn upstream", () => {
    expect(getAvailablePortageConditions(["9999"])).toEqual([]);
  });

  it("preserves ALL_PORTAGE_CONDITIONS order regardless of conditionIds order", () => {
    expect(getAvailablePortageConditions(["6000", "1000"])).toEqual([
      "new",
      "good",
      "fair",
      "poor",
    ]);
  });
});
