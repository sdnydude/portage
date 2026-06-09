import { describe, it, expect } from "vitest";
import {
  getAvailablePortageConditions,
  nearestAllowedCondition,
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

describe("nearestAllowedCondition", () => {
  it("keeps the current condition when allowed, else picks the nearest with a lower-grade tie-break", () => {
    // Already allowed — unchanged.
    expect(nearestAllowedCondition("good", ["new", "good", "poor"])).toBe("good");
    // Nearest by grade distance: like_new disallowed, good is 1 step down vs new 1 step up — tie → lower grade.
    expect(nearestAllowedCondition("like_new", ["new", "good"])).toBe("good");
    // Strictly nearest wins even when it's the higher grade.
    expect(nearestAllowedCondition("fair", ["new", "good"])).toBe("good");
  });
});
