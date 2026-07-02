export type PublishMode = "draft" | "ebay_draft" | "live";

/**
 * Map the publish-panel choices to a POST /listings publishMode:
 *  - live       = publish now
 *  - ebay_draft = create an UNPUBLISHED eBay offer (shows as a draft in Seller Hub); eBay only
 *  - draft      = Portage-local draft, no marketplace call
 */
export function resolvePublishMode(opts: {
  publishNow: boolean;
  ebayDraft: boolean;
  marketplace: string;
}): PublishMode {
  if (opts.publishNow) return "live";
  if (opts.ebayDraft && opts.marketplace === "ebay") return "ebay_draft";
  return "draft";
}
