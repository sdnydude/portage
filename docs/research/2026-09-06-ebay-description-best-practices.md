# eBay item descriptions: rules, evidence, and what converts (research report, 2026-09-06)

Status: research report for operator review. The listing template it proposes is
NOT approved and is not the spec; see "Proposed template (for discussion)".
Sources were read live on 2026-09-06 by a research agent; dates are per source.
Where a claim is eBay policy it is marked RULE; where it is conversion advice
from a seller or vendor it is marked HEURISTIC.

Why this matters in Portage: the scan description is published verbatim as the
eBay listing Description (`apps/api/src/routes/listings.ts`,
`applyFooter(item.description, …)`). Whatever the prompt in
`apps/api/src/lib/vision.ts` produces is what buyers read.

## 1. eBay's own rules (RULE)

| Rule | Source |
|---|---|
| Description must not contradict the Condition field anywhere in the listing. "Used" is defined as fully operational and functioning as intended; "For parts or not working" as not functioning as intended. | Item description policy — https://www.ebay.com/help/policies/listing-policies/item-description-policy?id=4372 ; Item condition by category — https://www.ebay.com/help/selling/listings/creating-managing-listings/item-conditions-category?id=4765 |
| Money Back Guarantee covers "doesn't match the listing description" regardless of "no returns" or "as-is" wording. | https://www.ebay.com/help/policies/ebay-money-back-guarantee-policy/ebay-money-back-guarantee-policy?id=4210 ; Selling practices — https://www.ebay.com/help/policies/writing-policies/sell-practices-policy?id=4346 |
| No JavaScript, iframes, forms, widgets ("active content"); static HTML only, mobile-friendly. | https://www.ebay.com/help/policies/listing-policies/javascript-policy?id=4247 |
| Links only to eBay pages or approved video hosts; no external URLs, email, phone, social handles, other marketplaces. | Links policy — https://www.ebay.com/help/policies/listing-policies/links-policy?id=4248 ; Contact information — https://www.ebay.com/help/policies/member-behaviour-policies/publishing-contact-information-policy?id=4373 |
| No keyword stuffing, competitor brand names, "?"-hedged claims, comparisons to other products, promoting other listings. | Search manipulation — https://www.ebay.com/help/policies/listing-policies/search-browse-manipulation-policy?id=4243 |
| No copied manufacturer, catalog, or other-listing text or images (VeRO). Dimensions/weight are the tolerated exception. | Images/text policy — https://www.ebay.com/help/policies/listing-policies/images-text-policy?id=4240 |
| No special characters (sub/superscript etc.); primary language only. | Item description policy (id=4372) |
| Description max 500,000 characters including HTML. | developer.ebay.com item-description guide (via search snippet; page 403s to direct fetch) |
| Since Oct 2025, "For parts or not working" listings get Final Sale on remorse returns, a 3-day INAD window, and a buyer photo requirement. Honest condition selection now carries protection; "untested" listed as Used carries none. | Value Added Resource 2025-09-30 — https://www.valueaddedresource.net/ebay-for-parts-not-working-updates/ |

## 2. How buyers see the description (RULE + observed behavior)

- Legacy mobile mechanic (2016): descriptions ≤800 chars of basic HTML render in
  full; longer ones get a derived ~250-char summary unless the seller supplies a
  `<div vocab="https://schema.org/" typeof="Product"><span property="description">…</span></div>`
  block (≤800 chars). ChannelX 2016-04 — https://channelx.world/2016/04/what-counts-as-a-character-for-ebay-mobile ;
  developer.ebay.com mobile guide — https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/mobile.html (403 to fetch; content confirmed via search snippet).
- Since 2025 eBay shows an AI-generated summary paragraph plus "See full
  description", no seller opt-out, drawn from description + item specifics.
  Value Added Resource 2025-04-30 — https://www.valueaddedresource.net/ebay-ai-product-description-summaries-app/ ;
  2025-07 — https://www.valueaddedresource.net/ebay-ai-item-detail-highlights/ ;
  Magical Listing revisited 2026-02-21 — https://www.valueaddedresource.net/ebay-ai-magical-listing-revisited/
- Practical consequence: the first two or three sentences must stand on their own.

## 3. Search ranking (HEURISTIC, sources conflict)

- Frooition (updated 2026-07): Cassini "primarily indexes the title — not the
  description"; item specifics are the second lever; incomplete specifics
  suppress visibility. https://www.frooition.com/ebay-seo-guide/
- 3Dsellers (2025-07-17): relevance "includes your title, item specifics, and
  description content." https://www.3dsellers.com/blog/ebay-listing-optimization
- eBay's own pages say nothing about description indexing. Working assumption:
  title ≫ item specifics ≫ description. The description is a conversion
  surface, not an SEO surface. Model and part numbers belong in title and
  specifics.

## 4. What converts (HEURISTIC)

| Finding | Source |
|---|---|
| Lead with what it is + condition + what is included in the first 2–3 sentences; bury nothing. | 3Dsellers description guide 2026-06-15 — https://www.3dsellers.com/blog/ebay-listing-description |
| 150–300 words for a single used item; short paragraphs; 5–8 bullets for specs and contents. Descriptra's 50k-page study puts electronics at 300–500 words generally, eBay at 150–300. | Descriptra 2026-04-18 — https://descriptra.com/blog/ideal-product-description-length/ ; QuickList 2025-12-18 — https://getquicklist.app/blog/ebay-listing-description-best-practices-what-sells-vs-what-doesnt |
| Specific condition sentences ("light scuffs on the top edge, screen has no scratches") beat "good condition" or "gently used"; they are also the INAD defense. | GradeThread 2026-07-27 — https://gradethread.com/blog/ebay-item-not-as-described-return-defense-reseller ; QuickList (above) |
| "Tested and working" helps in disputes only when specific and backed by pre-ship photos; generic claims still lose. | eBay Community thread on untested/as-is electronics (~2024) — https://community.ebay.com/t5/Selling/selling-quot-untested-quot-electronics-quot-as-is-quot/td-p/33988631/ |
| Marketing fluff ("must-have", "amazing deal"), exclamation points, all-caps, emoji, multiple fonts hurt readability and trust on mobile. | export.ebay.com — https://export.ebay.com/en/growth/promotion-strategies/how-to-optimize-your-listings/ ; eBay Seller Center — https://www.ebay.com/sellercenter/listings/create-listings/best-practices |
| Write in own words; state brand, model/part number, what is included, key selling points; correct spelling. | eBay creating a listing — https://www.ebay.com/help/listings/creating-managing-listings/creating-listing?id=4105 |

## 5. Category-specific inclusions (HEURISTIC)

- Consumer electronics: exact model/part number, storage/spec, firmware/OS,
  battery health %, unlock/carrier status, included cables/charger/box,
  cosmetic specifics per surface. Sellbery 2025-06-10 — https://sellbery.com/blog/how-to-sell-iphone-on-ebay/
- Pro audio / music gear: serial, year/country, mods and repairs, functional
  tests per input/output. Reverb grade vocabulary: Excellent (near blemish-free),
  Very Good (minor marks, fully functional), Good (significant cosmetic wear,
  fully functional), Fair (minor functional issues), Poor (needs repair),
  Non-functioning. Reverb — https://help.reverb.com/hc/en-us/articles/40934592346395-Music-gear-conditions-What-they-mean-and-why-they-matter (403 to fetch; definitions via search snippet) ; https://reverb.com/page/reverb-listing-guidelines
- Cameras / lenses: brand/model, what is in the box, photographed flaws;
  shutter count, fungus/haze/separation, aperture-blade oil, sensor dust,
  light seals. Buyer guides flag "used/as-is/untested" as red flags here.
  eBay camera guide — https://pages.ebay.com/buy/guides/camera-selling-guide/ ; Earth Sun Film 2020-07-01 — https://earthsunfilm.com/deciphering-ebay-camera-listings-a-guide-for-newbies/
- Tools: model + kit number, corded/cordless and battery platform, each
  battery and charger listed, tested under power. FlipListr (undated, vendor
  claim of a 40–80% premium for tested vs as-is, uncited) — https://fliplistr.com/sell/tools

## 6. Can the value of a template be quantified?

Honest answer: only partly, and not from eBay.

- eBay publishes no conversion lift for description quality. Its own guidance
  ties visibility to item specifics and titles, not description text.
- Third-party numbers exist but are vendor claims or aggregate studies, not
  controlled tests on used goods: Descriptra's length study (50k product pages,
  2026-04) reports higher engagement in the 150–300-word band for eBay pages;
  FlipListr's 40–80% "tested vs as-is" premium is uncited; GradeThread and the
  eBay Community threads report fewer lost INAD cases with specific condition
  text, anecdotally.
- What can be measured inside Portage: sell-through and days-to-sale per
  listing before/after, INAD/return rate, and eBay's traffic report
  (impressions → views → sales) which Portage already pulls
  (`EbayAdapter.getTrafficReport`). A before/after on your own inventory is the
  only number that would be yours.

## 7. Proposed template (FOR DISCUSSION — not approved, not the current spec)

Constraints from you: your writing works; the AI should extend it, not replace
it; never "I am selling" or any announcing opener; first person, direct;
condition and function stated as fact; no hedging; no "untested".

Section order (eBay-visible summary first):

1. Opening, 2–3 sentences that stand alone: what it is (brand, exact model /
   part number), the one or two specs that define it, condition in a few
   words, what is included. Written the way you would say it to a buyer
   standing in front of the item.
2. Condition: per-surface, from the photos; "No scratches, dents, or wear." when
   none.
3. Function: what works, as fact.
4. Included: everything visible; what is normally included but absent.
5. Specs: 4–8 bullets a buyer searches for on this model; category extras
   above.
6. Your footer (already appended at publish from Settings).

Open questions for you: (a) labelled sections vs unlabelled paragraphs; (b)
bullets vs prose for specs; (c) length band; (d) whether to seed the model
with two or three of your own past descriptions as style examples so it
matches your voice instead of a generic one; (e) whether Function should be a
separate section or folded into Condition.

## 8. Conflicts and gaps in the sources

- Description indexing: Frooition says no, 3Dsellers says yes, eBay is silent.
- Length: Descriptra 300–500 for electronics vs eBay 150–300 for one used item.
- The 800/250-char mobile mechanic is 2016-era and undocumented on live pages.
- Emoji/caps: vendor blogs allow sparing use; eBay's export guidance and the
  special-characters rule say omit.
- No eBay-published A/B evidence on description structure exists.
