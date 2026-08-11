---
id: payout-hold-2026-08-investigation
title: "Payout Hold #2 — 24h Forensic Investigation (2026-08-08)"
sidebar_position: 6
---

# Payout Hold #2 — Forensic Investigation

Investigation session 2026-08-08 morning, triggered by the operator waking to
a new 30-day hold on all payouts — the second hold in 11 days. eBay support
declined to disclose the hold reason (stated as a security practice), so the
investigation documented every candidate signal from our side. Companion doc:
[eBay Payment Hold (Aug 2026)](/docs/ebay-support/ebay-payment-hold-2026-08)
carries the resulting support email.

## Question

Did anything happen in the past 24 hours on the eBay API connection that
eBay's security monitoring could read as a threat to the account — third-party
access, account takeover signals, or dead-ended call storms like the July
incident?

## Verdict

**No intrusion-shaped activity found.** Zero failed auth attempts, zero token
errors, no third-party access, no misconfiguration recurrence (the PR #269
boot guard has verified config on every deployment since July). The only new
eBay-visible behaviors in the window were legitimate:

| Signal | Detail | Assessment |
|--------|--------|------------|
| New polling pattern | Status-reconciliation sweep live since 08-07 05:30 ET: Trading `GetItem` on ~21 active listings / 45 min ≈ 670 read calls/day + `getOrders` × 2 users / 45 min | Ordinary authorized-app reads, far under rate limits; largest behavioral change in the window |
| Duplicate Listing warnings ×2 | Two SanDisk SSD listings (307075069863 / 307113191141) flagged as possible duplicates 08-07 afternoon | Two physically distinct units, each with its own health report + SKU; only new seller-risk signal |
| OAuth re-connect 08-08 06:51 ET | "eBay account connected" — operator refreshing after discovering the hold | Post-hold reaction, not a trigger (operator-confirmed) |
| Failed publish 08-08 06:50 ET | `MPN has an invalid value of "Not available"` — corrected, published 07:13 + Promoted Listing ad | Routine listing error |
| LAN outage 08-07 09:14–11:43 ET | Network switch lost power (operator-confirmed); all outbound calls died at DNS (`EAI_AGAIN`) | Invisible to eBay — no dead-ended API calls, unlike the July container incident |
| Funds-hold warning 08-07 ~14:33 ET | Trading warning 21917236 on listing activity | Hold signal already present the prior afternoon |

## Key distinctions from the July incident

The July 28 hold followed genuinely anomalous-looking activity (failed OAuth
attempts, disconnect/re-auth, from the 07-26 Doppler config corruption). This
window contains **none of that class**. The concern raised with eBay: the
account may carry a residual risk score from the resolved July false positive,
such that ordinary new activity re-triggers a hold.

## Forensic sources & method

- Durable `marketplace_sync_log` (survives container rebuilds): 12 order-sync
  failure rows, all from the LAN outage window, all local DNS failures
- Current container logs (pino, epoch-ms timestamps — authoritative clock)
- Host `journalctl -k`: `eno1` link down 09:14:39, up 11:43:38 (r8169)
- Live DB order/listing state cross-checked against the live Reverb API

**Timestamp gotcha (repeats will bite):** `marketplace_sync_log.created_at`
is `timestamp` without time zone; ad-hoc postgres.js queries parse it as
host-local ET and display +4h skew. Container epoch-ms timestamps are the
clock of record — the first timeline draft misplace the outage window by 4
hours until reconciled.

**Coverage gap found:** the 08-07 05:30→22:20 container logs were
unrecoverable — the json-file logging driver dies with the container on
rebuild. This directly triggered ship-program **Phase 8** (30-day log
retention into the dhg-aifactory registry + log
aggregation/reporting/analysis service with dashboard and AI log assistant).

## Duplicate-listing remediation

Each SSD listing is a distinct physical unit with its own drive-health report.
Fix at the source: per-unit differentiators in the title (health %, power-on
hours) and the SMART specifics in `ConditionDescription` (valid for used
conditions; eBay rejects it on ConditionID 1000 brand-new). Unit-specific
photos further separate the listings. Multi-quantity listing rejected: buyers
of used storage price on the exact unit's health.

## Related

- [eBay Payment Hold (Aug 2026) — support email](/docs/ebay-support/ebay-payment-hold-2026-08)
- [eBay Payment Hold (Jul 2026) — RESOLVED](/docs/ebay-support/ebay-payment-hold-2026-07)
- [eBay Account Security (ATO) & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening)
