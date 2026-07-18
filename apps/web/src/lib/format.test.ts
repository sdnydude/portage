import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats with thousands grouping and no cents", () => {
    expect(formatCurrency(1200)).toBe("$1,200");
  });

  it("keeps cents for non-integer amounts instead of rounding", () => {
    expect(formatCurrency(25.5)).toBe("$25.50");
  });
});
