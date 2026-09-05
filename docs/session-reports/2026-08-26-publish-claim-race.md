# 2026-08-26 — Publish claim race: from "the Promote section vanished" to a double-publish fix

Session span: 2026-08-25 22:34 ET → 2026-08-26 20:40 ET (two arcs: P7 tail, then this).

## The story

The session opened by resuming Deferral P7, only to find a parallel session had already committed all thirteen items at 22:36:48; this session ran the gates on that code (green) and relayed the one adversarial-review finding, then stood down.

The morning brought a report: while relisting an iPad Air the previous evening (eBay error 240 `LP_Miscat_Accessories_in_Tablet` until "Bundled" went into the title), the "Promote your listing" section disappeared from the eBay listing form. Investigation showed Portage's own promote toggle was untouched (deployed web image dated 08-23), the Marketing API showed the account eligible (campaign RUNNING, ad created at 19:34:22), and the listing had been ended at 19:37 with `EndingReason=OtherListingError` — the seller-side end reason. The section the operator saw missing was eBay's Sell form, not Portage; documented community pattern of the module failing to render on a relist after policy hits.

Then the real bug surfaced: at 11:56 the operator published an AsiaHorse riser and eBay "created a duplicate". Loki showed six `POST /listings` from an iPhone within 1.5 s sharing one idempotency key, four `AddFixedPriceItem` calls, two live listings (307147990898, 307147990977) stamped onto one row, both promoted, then duplicate-policy 422s on every revise. Root cause, verified by a fact-check advisor and a design advisor: the R3 insert-first idempotency (07-09) only serialized the INSERT; the resume-claim UPDATE refreshed price and nothing else, so its WHERE stayed true for every contender until the winner wrote the ItemID ~2.5 s later. `POST /listings/:id/publish` had no claim at all. On the client, `DisclaimerSheet`'s Accept button was disabled only on `!isChecked`, the sheet stayed mounted through the POST, and `handleCreate` had no re-entry guard — the key ref was reused synchronously, so every tap shared the key. Not a P7 regression: the claim block was unchanged since `1d6b8535`/`f60e9241`.

A third session was found mid-TDD on `fix/publish-claim-race` (one red test); it was closed and this session took the branch. Operator approved the full T0–T8 plan including advisor hardening. Built one test per edit: `listings.publishClaimedAt` column (direct ALTER — host `db:push` blocked by the secrets hook), INSERT stamp, claim SET + staleness WHERE (predicate asserted by rendering through `PgDialect`), 409 `PUBLISH_IN_PROGRESS` on in-flight loss, clear on ItemID write, selective release (`AppError | EbayTradingError` only; raw network errors keep the stamp), `EbayAdapter.findListingBySku` over `GetMyeBaySelling` for stale-claim adopt on both routes, the same claim on `/:id/publish` before the self-heal block, `runStuckClaimSweep` (boot + 5 min), and the web `inFlightRef` + `busy` prop. Adversarial review found three real defects before commit: the sweep read `listings.ebaySku` (always NULL on a stuck row — must join `items.ebaySku`), the claim leaked on post-claim pre-flight throws (BO-3, Reverb category) → moved release to the route's outer catch, and unbounded pagination → `MAX_PAGES` 10.

Live proof against the real eBay account: three concurrent same-key publishes → one 201 + two 409 in <50 ms, a single `AddFixedPriceItem` in Loki; two concurrent `/:id/publish` on a draft → 200 + 409 in 12 ms. `proof-before-push` demanded FE screenshots, so a Playwright spec was written that stubs only the CF session exchange and the `/listings` response (held 2.5 s, then 409) — two taps → one POST asserted, "Creating..." disabled, 409 rendered. PR #331 merged after a one-line lint fix (`require` → `import`); docs PR #333 merged with ship-log 138.

Mishap: proof 1 was run on a Lumix 12-35 that had already sold — the item picker used raw `items.status` (`unlisted`) instead of the derived display status. The listing was ended within 90 s; correction captured.

## Learnings

- `items.status` is a manual state; "sold" is derived from listing rows. Any script that selects real items for a live action must exclude items with any listing row (active, draft, or sold) and confirm with the operator.
- A conditional-UPDATE "claim" only serializes what its WHERE excludes. If the original publisher doesn't change the row before the external call, retry-vs-original is not covered — only retry-vs-retry.
- `vi.clearAllMocks()` keeps implementations and unconsumed `mockReturnValueOnce` queues; a test that leaves Once mocks unconsumed leaks them into later tests. Persistent per-test defaults + `mockReset` in `finally` are safer than counting boot-time calls.
- Two processes' worth of `Once` mocks: when a route gains a new DB call, every test that queues update/select mocks by position for that route shifts. The reverb publish tests needed a leading claim mock.
- `callTradingApi` returns the whole parsed document, not the `*Response` object — key off `GetMyeBaySellingResponse`.
- Playwright against the CF-fronted prod app: mint the internal JWT, write `storageState`, run with `--no-deps`, and stub `**/auth/session` so the mount-time exchange doesn't log the page out.
- `proof-before-push` treats any `apps/web` change as visual; `*.png` is gitignored under `website/docs/proof` — proofs ship as `.jpg`.

## Insights

- The eBay "Promote your listing" section vanishing on a relist after policy hits is an eBay Sell-form behaviour; account-level ad eligibility can be verified directly via the Marketing API (`ad_campaign` RUNNING + ad creation succeeding) before suspecting Portage.
- Relisting via Sell similar carries the Portage SKU (custom label) onto eBay-direct listings Portage never stored — `GetMyeBaySelling` showed four listings under `PRT-000130` across two physical items.
- `EndingReason=OtherListingError` in GetItem is the seller's "error in my listing" choice, not an eBay-initiated takedown.

## Deferred

None. All three review findings fixed pre-commit; all plan items T0–T8 built and proven.
