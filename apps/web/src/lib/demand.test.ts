import { describe, it, expect } from "vitest";
import { demandLabel } from "./demand";

describe("demandLabel", () => {
  it("returns Hot at exactly 2/3 (>= boundary)", () => {
    expect(demandLabel(2 / 3)).toBe("Hot");
  });

  it("returns Normal at exactly 1/3 (Slow is strictly below)", () => {
    expect(demandLabel(1 / 3)).toBe("Normal");
  });

  it("returns Slow strictly below 1/3, Normal mid-band, null on no data", () => {
    expect(demandLabel(0.333)).toBe("Slow");
    expect(demandLabel(0.5)).toBe("Normal");
    expect(demandLabel(null)).toBeNull();
    expect(demandLabel(undefined)).toBeNull();
  });
});
