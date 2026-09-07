# eBay item description: rules and best practices (research 2026-09-06)

Why: the scan description is published verbatim as the eBay listing Description
(`apps/api/src/routes/listings.ts` → `applyFooter(item.description, …)`), so the
scan prompt (`DETAILED_SYSTEM_PROMPT`, `apps/api/src/lib/vision.ts`) is what
buyers read. This note is the source for the description spec in that prompt.
Sources were read live on 2026-09-06; dates per source.

## Facts that shaped the spec

- **Search ranking.** Cassini indexes the title first, item specifics second;
  description text is a conversion surface, not an SEO surface (Frooition
  2026-07; 3Dsellers 2025-07 disagrees mildly; eBay is silent). Keep model and
  part numbers in title + specifics; write the description for buyers.
- **Mobile / AI summary.** eBay shows a short summary first (legacy ≤800-char
  full render or ~250-char derived summary, 2016 mechanic; since 2025 an
  eBay.AI paragraph plus "See full description", no opt-out). The first 2–3
  sentences must stand alone.
- **Condition consistency is the biggest policy and INAD risk.** eBay's item
  description policy bans descriptions that contradict the Condition field.
  "Used" means fully operational; "For parts or not working" means it does not
  function as intended. The Money Back Guarantee covers "doesn't match the
  description" regardless of "no returns" or "as-is" wording. Since Oct 2025,
  for-parts listings get Final Sale on remorse returns and a 3-day INAD window,
  so honest condition selection carries protection; "untested as Used" carries
  none.
- **Description max** is 500,000 characters including HTML (developer.ebay.com).
  Portage's own cap is 4,000 (raised from 2,000 on 2026-09-06).

## Do / don't

| Do | Don't | Rule or heuristic |
|---|---|---|
| Own words: brand, exact model/part number, what is included, defining specs | Copy manufacturer or other listings' text/images (VeRO) | Rule |
| Describe every defect, repair, missing part in text; match the Condition field | Claim "works" on a for-parts listing; list untested gear as Used | Rule |
| Shipping/returns/payment in the listing fields | "no returns / as-is / sold as seen" in the description | Rule (MBG) |
| Static text or basic HTML | JavaScript, iframes, forms, widgets, fixed widths | Rule |
| Links only to eBay pages | External URLs, email, phone, socials, other marketplaces | Rule |
| Words that describe this item only | Keyword stuffing, competitor brands, "?"-hedged claims | Rule |
| Lead with what it is + condition + what is included (first 2–3 sentences) | Bury condition; open with policies or cross-sells | Heuristic |
| 150–300 words, short paragraphs, 4–8 spec bullets | Walls of text, >500 words for one used item, marketing fluff | Heuristic |
| Specific per-surface condition sentences | "Good condition", "gently used" with no specifics | Heuristic (INAD defense) |
| Say what works, specifically | "Untested", "powers on but not further tested" while Condition = Used | Heuristic + rule interplay |
| Plain text, symbols spelled out | Special characters, all-caps, emoji | Rule (special chars) / heuristic |

## Template the prompt encodes

Sections in order, each label on its own line: **Overview** (2–3 standalone
sentences), **Condition** (per-surface, from photos; "No scratches, dents, or
wear." if none), **Function** (stated as fact in the seller's voice; Used =
fully operational), **Included** (everything visible; note what is normally
included but absent), **Specs** (4–8 bullets a buyer searches for on this
model). Category extras: electronics — storage, firmware/OS, battery health,
carrier/unlock; audio/music gear — serial if legible, year/country, mods or
repairs (Reverb grade vocabulary: Excellent / Very Good / Good / Fair / Poor);
cameras/lenses — mount, shutter count, fungus/haze/dust; tools — corded or
cordless, battery platform, each battery and charger.

Never: hedging, "untested", "as-is", "no returns", shipping or return terms,
marketing adjectives, keyword lists, competitor brands, copied copy, URLs,
contact details, other marketplaces, invented specs. Phones: model + storage +
unlock status, never the full IMEI.

## Sources

eBay policies: item description (id=4372), JavaScript/active content (4247),
links (4248), contact information (4373), search manipulation (4243),
images/text VeRO (4240), selling practices (4346), item condition by category
(4765), Money Back Guarantee (4210), creating a listing (4105); eBay Seller
Center listing best practices; export.ebay.com "How to optimize your listings".
Third party: Frooition eBay SEO guide (2026-07), 3Dsellers (2025-07, 2026-06),
Descriptra 50k-page length study (2026-04), QuickList (2025-12), GradeThread
INAD defense (2026-07), Value Added Resource on AI summaries (2025-04, 2025-07)
and for-parts changes (2025-09), ChannelX mobile summary (2016-04), Reverb
condition guide and listing guidelines, FlipListr tools guide, Sellbery iPhone
guide (2025-06), Earth Sun Film camera listings (2020-07).

Conflicts noted: description indexing (Frooition no vs 3Dsellers yes); length
(Descriptra 300–500 for electronics vs eBay 150–300 for a single used item);
the 800/250-char mobile mechanic is 2016-era and undocumented on live pages.
