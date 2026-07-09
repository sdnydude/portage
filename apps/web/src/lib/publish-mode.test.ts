import { describe, it, expect } from "vitest";
import { resolvePublishMode } from "./publish-mode";

describe("resolvePublishMode", () => {
  it("maps publish-panel choices to a POST /listings publishMode", () => {
    // publish now → live (regardless of the eBay-draft toggle)
    expect(resolvePublishMode({ publishNow: true, ebayDraft: false, marketplace: "ebay" })).toBe("live");
    expect(resolvePublishMode({ publishNow: true, ebayDraft: true, marketplace: "ebay" })).toBe("live");
    // not now + eBay-draft toggle on + eBay → eBay draft (unpublished offer)
    expect(resolvePublishMode({ publishNow: false, ebayDraft: true, marketplace: "ebay" })).toBe("ebay_draft");
    // eBay-draft only applies to eBay; on reverb it falls back to a local draft
    expect(resolvePublishMode({ publishNow: false, ebayDraft: true, marketplace: "reverb" })).toBe("draft");
    // not now + toggle off → local (Portage-only) draft
    expect(resolvePublishMode({ publishNow: false, ebayDraft: false, marketplace: "ebay" })).toBe("draft");
  });
});
