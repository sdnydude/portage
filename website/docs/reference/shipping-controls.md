---
id: shipping-controls
title: Per-Listing Shipping Controls
sidebar_position: 5
---

# Per-Listing Shipping Controls

Per-listing shipping choices for eBay and Reverb, shipped 2026-08-01 as
PR [#274](https://github.com/sdnydude/portage/pull/274) (beta request
`17be7322`), with the eBay local-pickup add-on following in PR
[#276](https://github.com/sdnydude/portage/pull/276). Before this, every eBay
listing published with calculated shipping and every Reverb listing followed
the seller profile's shipping defaults.

## The touched contract

Both marketplaces follow the same rule as the accept-offers toggle
(`offersEnabledExplicit`, PR #264): **nothing is sent until the seller
explicitly touches a shipping control.** Untouched publishes carry no
`ebayShipping`/`reverbShipping` key, so server and seller-profile defaults
stay in charge, and pre-feature listings keep their behavior on sync.

The keys ride `marketplaceSpecificFields` and are persisted on the listing
row, so a later price-change revise re-sends the same shipping intent instead
of silently falling back to calculated (pinned by route tests).

## eBay — `ebayShipping`

```ts
interface EbayListingShipping {
  method: 'calculated' | 'flat' | 'free';
  flatCost?: number;      // buyer-paid rate, method='flat'
  service?: string;       // eBay ShippingService enum; absent → USPSPriority
  handlingDays?: number;  // → Trading DispatchTimeMax; absent → 1
  localPickup?: boolean;  // add-on Pickup service option (PR #276)
}
```

### VERIFY-FIRST: every shape is live-verified

No builder shape was frozen from memory or documentation alone. The
`ebay-verify-dryrun.ts` matrix (11 `VerifyAddFixedPriceItem` calls on
2026-08-01 — validation only, no listings created) established:

| Shape | Verdict |
|---|---|
| Flat + `ShippingServiceCost`, no `CalculatedShippingRate` | ✅ legal |
| Flat without `ShippingPackageDetails` | ✅ legal |
| Free = flat + `FreeShipping true`, explicit `0.00` cost | ✅ legal (cost tag optional) |
| Calculated with non-default service / `DispatchTimeMax` override | ✅ legal |
| Local pickup as a **second** `ShippingServiceOptions` entry | ✅ legal |
| Local pickup **only** (no real service) | ❌ *"You must select at least one domestic shipping service, other than local pickup"* |

Hence local pickup is a **toggle riding alongside** the chosen method, never a
method itself. Flat/free with no stored weight keep `ShippingPackageDetails`
with the weight floored to 1 oz so known dimensions still reach eBay
(operator decision); all-zero dimension tags are omitted.

### Service enums come from the probe, never memory

The service select is fed from `ebay-shipping-services-probe.ts`
(GeteBayDetails `ShippingServiceDetails`) output. The 2026-08-01 probe returned
84 domestic `ValidForSellingFlow` services and contradicted training-data
assumptions: `USPSFirstClass` is **not** deprecated and `USPSGroundAdvantage`
does not exist in the live catalog. Current select: USPS Priority (default),
USPS First Class, USPS Ground (Parcel Select), USPS Media Mail, UPS Ground,
FedEx Home Delivery, FedEx 2Day, UPS 2nd Day Air.

### The package-enum translation (error 37)

`items.ebayPackageType` stores **Inventory-API** enums (`MAILING_BOX`,
`LETTER`, …). Trading takes `ShippingPackageCodeType` — forwarding the stored
values raw fails publish with error 37 (found live 2026-08-01, same day). The
adapter translates via `TRADING_SHIPPING_PACKAGE` (values live-verified with
GeteBayDetails `ShippingPackageDetails`: `Letter`, `LargeEnvelope`,
`PackageThickEnvelope`, `USPSLargePack`); unknown values fall back to the
builder default.

## Reverb — `reverbShipping`

```ts
interface ReverbListingShipping {
  profileId?: string;       // explicit Reverb shipping-profile choice
  localPickupOnly?: boolean; // drop profile/rates, publish shipping{local:true}
}
```

Applied **after** the seller-profile fill in `applyReverbEnrichment` — the
same precedence pattern as `offersEnabledExplicit` — so an explicit per-listing
choice always wins over `reverbDefaultShipping`, while untouched listings keep
following profile changes on sync. `localPickupOnly` deletes
`shippingProfileId`/`shippingRates` and publishes `shipping{local:true}`
(legal on Reverb, unlike eBay). The sheet's profile select is fetched live
from `GET /marketplace/reverb/shipping-profiles`; profiles created in the
Reverb shop settings appear automatically. Reverb's API has **no**
expedited/2-day rate field (docs-verified) — expedited offerings are modeled
as additional Reverb-side shipping profiles.

## UI surfaces

The eBay fields live in one shared component,
`ShippingFieldsSection` (`apps/web/src/components/listing/shipping-fields-section.tsx`),
rendered in three places:

1. **Publish sheet** (`CreateListingSheet`) — eBay section + Reverb profile
   select; `shippingTouched` ref implements the touched contract
2. **Scan review** (`ScanFlow`) — ride-along section whose values seed the
   publish sheet via `initialShipping` (a seed counts as touched)
3. **Listing card** (`ListingCard`) — "Edit shipping" inline editor; its save
   client-side spreads the stored `marketplaceSpecificFields` because the
   PATCH route full-replaces the JSONB (the aspect-merge pattern)

The listing flow (`useListingFlow`) also emits `ebayShipping` on publish when
its persisted `shippingTouched` flag is set (ShippingConfigCard method pills +
flat-cost input).

## Related

- [eBay Trade-First Publishing](/docs/reference/ebay-trade-first) — the
  publish pipeline these controls plug into
- [Marketplace Adapters](/docs/architecture/marketplace-adapters) — adapter
  contract and `marketplaceSpecific` escape hatch
