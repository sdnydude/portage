import { describe, it, expect } from "vitest";
import { poundsToLbOz, lbOzToPounds, ebayEstimateToWeightDims } from "./weight";

describe("poundsToLbOz", () => {
  it("returns zeroes for null/zero/negative", () => {
    expect(poundsToLbOz(null)).toEqual({ lb: 0, oz: 0 });
    expect(poundsToLbOz(undefined)).toEqual({ lb: 0, oz: 0 });
    expect(poundsToLbOz(0)).toEqual({ lb: 0, oz: 0 });
    expect(poundsToLbOz(-3)).toEqual({ lb: 0, oz: 0 });
  });

  it("splits whole pounds and remaining ounces", () => {
    expect(poundsToLbOz(3.5)).toEqual({ lb: 3, oz: 8 }); // 3 lb 8 oz = 56 oz
    expect(poundsToLbOz(1)).toEqual({ lb: 1, oz: 0 });
    expect(poundsToLbOz(0.5)).toEqual({ lb: 0, oz: 8 });
  });

  it("rounds to the nearest whole ounce", () => {
    // 2.51 lb = 40.16 oz -> 40 oz -> 2 lb 8 oz
    expect(poundsToLbOz(2.51)).toEqual({ lb: 2, oz: 8 });
  });
});

describe("lbOzToPounds", () => {
  it("returns null when the total is zero", () => {
    expect(lbOzToPounds(0, 0)).toBeNull();
  });

  it("combines lb + oz into decimal pounds", () => {
    expect(lbOzToPounds(3, 8)).toBe(3.5);
    expect(lbOzToPounds(1, 0)).toBe(1);
    expect(lbOzToPounds(0, 8)).toBe(0.5);
  });

  it("clamps negative inputs to zero", () => {
    expect(lbOzToPounds(-2, 8)).toBe(0.5); // -2 -> 0, so 8 oz
    expect(lbOzToPounds(1, -5)).toBe(1); // -5 -> 0, so 1 lb
  });

  it("round-trips with poundsToLbOz through whole ounces", () => {
    for (const lbs of [0.5, 1, 2.5, 3.5, 6.25, 10]) {
      const { lb, oz } = poundsToLbOz(lbs);
      expect(lbOzToPounds(lb, oz)).toBe(lbs);
    }
  });
});

describe("ebayEstimateToWeightDims", () => {
  it("converts ounces to decimal pounds", () => {
    const out = ebayEstimateToWeightDims({
      weight: { value: 56, unit: "oz" },
      dimensions: { length: 10, width: 8, height: 4, unit: "in" },
      packageType: "MAILING_BOX",
    });
    expect(out.weight).toBe(3.5);
    expect(out.dimLength).toBe(10);
    expect(out.dimWidth).toBe(8);
    expect(out.dimHeight).toBe(4);
    expect(out.ebayPackageType).toBe("MAILING_BOX");
  });

  it("passes pounds through unchanged", () => {
    const out = ebayEstimateToWeightDims({
      weight: { value: 2, unit: "lb" },
      dimensions: { length: 5, width: 5, height: 5, unit: "in" },
    });
    expect(out.weight).toBe(2);
  });

  it("treats non-positive weight and dimensions as null (missing, not zero)", () => {
    const out = ebayEstimateToWeightDims({
      weight: { value: 0, unit: "oz" },
      dimensions: { length: 0, width: 0, height: 0, unit: "in" },
    });
    expect(out.weight).toBeNull();
    expect(out.dimLength).toBeNull();
    expect(out.dimWidth).toBeNull();
    expect(out.dimHeight).toBeNull();
    expect(out.ebayPackageType).toBeNull();
  });

  it("handles full-word and uppercase ounce units", () => {
    expect(ebayEstimateToWeightDims({
      weight: { value: 16, unit: "OUNCES" },
      dimensions: { length: 1, width: 1, height: 1, unit: "in" },
    }).weight).toBe(1);
  });
});
