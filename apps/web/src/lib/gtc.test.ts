import { describe, it, expect } from "vitest";
import { nextGtcRenewal } from "./gtc";

describe("nextGtcRenewal", () => {
  it("returns the next monthly anniversary after now, clamping short months", () => {
    expect(
      nextGtcRenewal(new Date("2026-07-05T14:00:00Z"), new Date("2026-07-20T00:00:00Z")).toISOString(),
    ).toBe("2026-08-05T14:00:00.000Z");
    expect(
      nextGtcRenewal(new Date("2026-01-31T12:00:00Z"), new Date("2026-02-01T00:00:00Z")).toISOString(),
    ).toBe("2026-02-28T12:00:00.000Z");
  });
});
