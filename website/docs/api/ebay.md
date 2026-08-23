---
id: ebay
title: eBay API Reference
sidebar_position: 8.5
---

# eBay API Reference

Every eBay call Portage makes, where it lives in code, and the traps that have
bitten us. Connection, OAuth callback and token storage are documented on the
[Marketplace](/docs/api/marketplace) page and are not repeated here.

## Trade-First listing lifecycle (Trading API, XML)

Listings run on the **Trading API** (decision PR #133, live-proven): no
Business Policies, no Inventory-API offers. All calls go through
`callTradingApi()` in `apps/api/src/marketplace/ebay-trading-client.ts`
(endpoint `https://api.ebay.com/ws/api.dll`, compatibility level 1207,
`X-EBAY-API-CALL-NAME` header, XML body).

| Call | Used for | Code |
|------|----------|------|
| `AddFixedPriceItem` | Publish a listing (inline shipping terms, item specifics, Best Offer) | `ebay-adapter.ts` `createListing` |
| `ReviseFixedPriceItem` | Full content revise: title, description, price, specifics, photos, shipping | `ebay-adapter.ts` `updateListing` |
| `ReviseInventoryStatus` | Price / quantity-only fast path (no content rebuild) | `ebay-adapter.ts` `updateListing` |
| `EndFixedPriceItem` | End a listing (archive) | `ebay-adapter.ts` `deleteListing` |
| `GetItem` | Status sweep, Best Offer heal, verification, item detail | `ebay-adapter.ts` `getListingStatus`, `getEbayItemVerification`, `getItemDetail` |
| `GetMemberMessages` | Buyer messaging sync (`POST /messages/sync`) | `routes/messages.ts`, parser in `ebay-trading-client.ts` |
| `AddMemberMessageRTQ` | Reply to a buyer | `ebay-trading-client.ts` `buildReplyXml` |

Notes that matter in practice:

- A live listing id starts with `3`; a `1`-prefixed id is an Inventory-API
  offer that never went live (silent-fail class).
- `ReviseFixedPriceItem` rebuilds the whole item, so every revise re-sends
  package weight and dimensions (error 25020 otherwise), the ship-from ZIP
  and the leaf category.
- `ItemSpecifics` is a full replace on revise. A specific removed from the
  item is stripped from the listing row in the same transaction so the next
  revise drops it on eBay too; a category-*required* specific cannot be
  removed (`EBAY_ASPECTS_REQUIRED` terminal-fails the sync job).
- Best Offer thresholds are validated before any revise (`BO-3` pre-flight);
  a conflict heals from `GetItem` and returns `422 BEST_OFFER_CONFLICT` with
  the live numbers. Stored thresholds are never deleted (decision 2026-08-06).

## REST APIs

| API | Endpoint | Used for | Code |
|-----|----------|----------|------|
| Taxonomy | `GET /commerce/taxonomy/v1/category_tree/0/get_category_suggestions` | Leaf category from a title | `ebay-adapter.ts` `getCategorySuggestion` |
| Taxonomy | `GET /commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category` | Required / recommended item specifics | `ebay-adapter.ts` `getRequiredAspects` |
| Metadata | `GET /sell/metadata/v1/marketplace/EBAY_US/get_negotiated_price_policies` | Whether a category supports Best Offer | `ebay-adapter.ts` |
| Metadata | `GET /sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies` | Valid condition ids per category | `ebay-adapter.ts` |
| Fulfillment | `GET /sell/fulfillment/v1/order` | Order sync (paginated, 10-page cap per sweep) | `ebay-adapter.ts` `getOrders` |
| Analytics | `GET /sell/analytics/v1/traffic_report` | Listing traffic in the optimizer panel | `ebay-adapter.ts` `getTrafficReport` |
| Marketing | `GET/POST /sell/marketing/v1/ad_campaign`, `POST .../ad_campaign/{id}/ad` | Promoted Listings (advertising toggle) | `ebay-adapter.ts` |
| Browse | `GET /buy/browse/v1/item_summary/search` | Comps for pricing (app token) | `ebay-adapter.ts` `searchComps` |
| Identity | `GET /commerce/identity/v1/user/` | Display name after OAuth | `routes/marketplace/ebay-auth.ts` |
| OAuth | `POST /identity/v1/oauth2/token` | Code exchange, refresh, client-credentials app token | `ebay-auth.ts`, `token-manager.ts` |

## OAuth scopes

Requested at connect time (`apps/api/src/routes/marketplace/ebay-auth.ts`):

```
sell.inventory
sell.marketing
sell.account
sell.fulfillment
sell.analytics.readonly   (added 2026-06 — earlier connections must reconnect)
commerce.identity.readonly
```

### The RuName trap

`EBAY_REDIRECT_URI` is **not a URL**. It is the eBay *RuName* (for example
`Digital_Harmony-DigitalH-portag-abcdef`) registered in the developer
portal; eBay resolves it to the accept/decline URLs you configured there.
Putting the callback URL in that variable produces `invalid_request` on the
token exchange with no further detail. Production and sandbox have different
RuNames and different app credentials (`EBAY_SANDBOX=false` in prod).

## Marketplace Account Deletion (compliance)

eBay requires every app to accept account-deletion notifications.
`GET|POST /marketplace/ebay/account-deletion` (`routes/marketplace/ebay-deletion.ts`)
answers the challenge, verifies the ECDSA-SHA1 signature against eBay's public
key, anonymizes the user's marketplace data synchronously, and records an
HMAC-keyed identity in `ebay_deleted_identities` so the account cannot be
silently re-populated. It is mounted before the JSON body parser with its own
100 kB raw parser. Shipped in deferral P1 (2026-08-19).

## Rate limits and retries

There is **no outbound retry or backoff for eBay calls today**. The only
automatic recovery is a single retry after a `401`/`403` on the Browse comps
search, which invalidates the cached app token and re-mints it. Everything
else surfaces as a marketplace sync-job failure (with the durable
`marketplace_sync_log` row and the listing-card badge) or as a `502` on the
inline publish path. eBay's published daily call limits are far above beta
traffic; the ATO detector (user IP different from server IP) is normal for a
hosted app and is not a limit.

## Related

- [Marketplace](/docs/api/marketplace) — connect / callback / status / disconnect, token encryption
- [Listings](/docs/api/listings) — publish, revise, archive endpoints that drive the calls above
- [Orders](/docs/api/orders) — Fulfillment sync
