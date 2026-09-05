import { describe, it, expect } from "vitest";
import { withKeys } from "./list-keys";

describe("withKeys", () => {
  it("pairs each item with a key that stays unique across repeats", () => {
    const pairs = withKeys(["a", "b", "a"], (s) => s);
    expect(pairs.map(([, item]) => item)).toEqual(["a", "b", "a"]);
    expect(new Set(pairs.map(([key]) => key)).size).toBe(3);
  });
});
