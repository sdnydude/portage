import { describe, it, expect } from "vitest";
import { isTabRoute, pageTitle, porterPills } from "./navigation";

describe("navigation", () => {
  it("isTabRoute: true for the 4 bar tabs and root, false for Listings/More/detail/settings routes", () => {
    for (const r of ["/home", "/inventory", "/porter", "/orders", "/"])
      expect(isTabRoute(r), r).toBe(true);
    for (const r of ["/listings", "/more", "/inventory/abc-123", "/settings/help", "/messages", "/list", "/orders/xyz", "/tutorials"])
      expect(isTabRoute(r), r).toBe(false);
  });

  it("pageTitle: longest-prefix match with Portage fallback", () => {
    expect(pageTitle("/settings/seller-profile")).toBe("Seller Profile");
    expect(pageTitle("/inventory/abc")).toBe("Inventory");
    expect(pageTitle("/unknown/thing")).toBe("Portage");
  });

  it("porterPills: page-specific pills with default fallback", () => {
    expect(porterPills("/inventory")).toContain("What's unlisted?");
    expect(porterPills("/orders/xyz")).toContain("What needs shipping?");
    expect(porterPills("/settings/help")).toEqual([
      "What should I list next?",
      "How's my inventory doing?",
    ]);
  });
});
