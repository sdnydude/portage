---
id: ebay-payment-hold-2026-08
title: "eBay Payment Hold (Aug 2026) — OPEN"
sidebar_position: 5
---

# eBay Payment Hold — August 2026 Incident

:::caution Open
**Status: OPEN.** A new hold on all payouts (30 days) appeared the morning of
2026-08-08 — a separate event from the [July 2026
hold](/docs/ebay-support/ebay-payment-hold-2026-07), which was resolved 2026-08-02.
The support email below was drafted 2026-08-08.
:::

## Context

Discovered by the operator on waking 2026-08-08: all payouts on hold for 30
days. Second hold in 11 days; the first (2026-07-28) followed the OAuth
environment incident and was resolved after the 2026-08-01 support email.

A 24-hour forensic review of the application's eBay API activity
(2026-08-07 → 08-08) found **no auth failures, no third-party access, no
misconfiguration recurrence**. The only new behaviors eBay's systems saw in the
window:

- A new read-only status-reconciliation feature went live 08-07 05:30 ET
  (Trading `GetItem` on ~21 active listings every 45 min ≈ 670 read calls/day,
  plus Fulfillment `getOrders` every 45 min).
- Two "Duplicate Listing policy" warnings on 08-07 — two physically distinct
  SanDisk SSD units of the same model, each individually listed with its own
  drive-health report and SKU. eBay gives no hold reason (support: withheld
  as a security practice), so the email documents every candidate signal.
- Normal listing/selling activity, including one failed publish (invalid MPN)
  and one successful publish + Promoted Listing ad on 08-08 morning.
- An OAuth re-connect at 08-08 06:51 ET — the owner refreshing the connection
  **after** discovering the hold (reaction, not trigger).
- A 2.5 h LAN outage 08-07 09:14–11:43 ET (network switch lost power) during
  which zero API calls reached eBay — DNS failed locally.

## Support email (as drafted 2026-08-08)

> **To:** eBay Customer Support / Account Security
> **Subject:** New payment hold Aug 8 — full account-owner activity report, and question of connection to the resolved July 28 case
>
> Hello,
>
> I'm writing about a new hold placed on all payouts from my seller account,
> which I discovered on the morning of August 8, 2026, with a stated duration
> of 30 days. This is the second hold on my account in 11 days. The first
> (placed around July 28) was reviewed and resolved on August 2 after I
> explained the activity in detail; I'm including that background at the end
> because I'd like your team to check whether the two events are connected.
>
> **Who I am, and what "Portage" is.** My name is Stephen Webber. I own this
> eBay account (username: [redacted], login email: [redacted]). I'm the
> founder of Digital Harmony Group, a small software company, and I built an
> application called **Portage**: an inventory app for cataloging personal
> effects and selling them across marketplaces. A user photographs an item,
> the app catalogs it, and when the user chooses to sell, it creates and
> manages the listing through each marketplace's official API — for eBay,
> through the Developers Program OAuth flow (application keyset beginning
> `[redacted-PRD]`). Portage is pre-launch; right now I am its one
> live seller, using it to sell my own belongings — which is why every API
> call it makes traces to this one account. It runs on a server at my home,
> so its API traffic has always come from that single, stable IP address.
> The app has been listing and selling on my account since June 2026. All
> the application activity described below is Portage doing its normal job.
>
> **What happened on my side in the 24 hours before this hold.** I keep
> detailed engineering logs, and I reviewed them fully before writing this:
>
> - On August 7 at 5:30 AM ET, I deployed a new **read-only** feature to my
>   application: it periodically checks the status of my own active listings
>   (about 21 listings, checked every 45 minutes — roughly 670 GetItem read
>   calls per day, spread out deliberately to stay far below rate limits) and
>   fetches my own recent orders every 45 minutes. Its purpose is keeping my
>   local inventory in sync with eBay — it reads, it does not modify.
> - On August 7 during the afternoon I listed items normally. Two listings of
>   similar SSD drives received "possible duplicate listing" policy warnings
>   in the API response. To be clear about these: they are two physically
>   different drives of the same model. I own multiple units, and each one is
>   individually tested — each listing carries its own drive-health report
>   for that specific unit, and each has its own inventory SKU in my system.
>   These are separate used items with genuinely different condition data,
>   not the same item listed twice; buyers of used storage rightly care about
>   the exact unit's health, which is why I list them individually rather
>   than as one multi-quantity listing. I'm also updating my listings so the
>   per-unit differences (health percentage, usage hours) appear in the title
>   and condition description, so both your automated systems and buyers can
>   see at a glance that the units are distinct.
> - On the morning of August 8: one listing attempt failed with an invalid
>   MPN field value, which I corrected; the listing then published normally
>   with a Promoted Listings campaign.
> - At 6:51 AM ET on August 8, after I woke up and discovered the hold, I
>   refreshed my application's authorization to eBay (a normal OAuth
>   re-consent, completed successfully on the first attempt). I mention it
>   for completeness: it happened after the hold, as part of my checking that
>   everything was healthy — it cannot have caused it.
>
> **What did NOT happen.** There were no failed sign-in or authorization
> attempts in this window — not one. No password or account-setting changes.
> No configuration errors like the July incident (I added an automated
> startup safeguard after that event, and it has been verifying the
> configuration on every deployment since). No third party accessed or
> attempted to access my account. My API traffic came from the same server
> IP it always has. I'll also note my home network lost its switch for about
> 2.5 hours on the morning of August 7 — during that time my application
> could not reach eBay at all, so if your systems saw a gap in my normal
> API pattern followed by a resumption, that was a power failure on a
> network switch, nothing more.
>
> **The July background, in case the events are connected.** The July 28 hold
> followed a genuine-looking anomaly: a configuration-management fault on
> July 26 corrupted my app's OAuth settings, and my July 28 repair produced
> several failed authorization attempts and a disconnect/re-authorization —
> all my own troubleshooting, as I explained in my August 1 email, after
> which the hold was resolved on August 2. My concern is that my account may
> now carry a heightened risk score from that false positive, such that
> ordinary activity — a new read-only sync feature, or two similar listings
> — re-triggers a hold that would not occur on an account with a clean
> score. I'd ask your team to check whether this new hold is a downstream
> effect of the July case rather than an independent finding.
>
> **My request.** Please review this hold. I asked your support team for the
> hold's reason and was told it can't be disclosed for security reasons — I
> understand, and that's why this email documents everything rather than one
> guess. If the hold was triggered by the new read-only polling pattern, the
> duplicate-listing flags on what are physically distinct units, or residue
> from the July case, I'd ask that it be released or shortened, since all
> activity is documented owner activity from a registered developer
> application. I'm
> glad to verify my identity by any means you need, and I can provide my
> engineering logs and timeline for any specific window you're interested in.
>
> Thank you,
>
> Stephen Webber

## Short-form support message (submitted via support form, ≤1000 chars — rev 3, 999 chars)

> **Subject:** Second payout hold in 11 days — requesting review and return to 2-day payouts
>
> I own this account (username: [redacted]). I sell my own belongings
> through Portage, an inventory and selling app I wrote. It's registered
> with the eBay Developers Program, hasn't launched yet, and I'm its only
> user. It runs on an on-premises server, so my API traffic has come from
> the same IP since June.
>
> On Aug 8 all my payouts went on a 30-day hold, the second hold in 11 days.
> The first (July 28) was released Aug 2 after I explained the flagged
> activity: my own repair of the app's broken OAuth config.
>
> I went through my logs for the 24 hours before this hold. No failed
> sign-ins, no auth errors, no account changes, no access from anywhere
> unusual. Just normal selling, plus the app reading the status of my 21
> listings (about 650 GetItem calls a day). Two SSDs of the same model got
> duplicate-listing warnings; they are different drives, each with its own
> health report.
>
> Nothing in this window threatened the account. Please review the hold and
> return my payouts to 2 days after delivery.

<details>
<summary>Rev 2 (996 chars, superseded 09:17 for tone)</summary>

> **Subject:** Second payout hold in 11 days — clean activity audit attached, requesting restore to 2-day post-delivery payouts
>
> I'm the account owner (username: [redacted]). I sell through Portage, an
> inventory app I built for cataloging and selling personal items —
> registered via eBay's Developers Program, pre-launch, with me as its only
> user, running from my home server (one stable IP since June). All payouts
> went on hold for 30 days as of Aug 8 — my second hold in 11 days. The July
> 28 hold was resolved Aug 2 after I documented the flagged activity as my
> own OAuth repair work.
>
> I've audited my logs for the 24 hours before this hold: zero failed
> sign-ins, zero auth errors, no account changes, no unfamiliar access. Only
> normal selling plus the app's read-only status checks on my 21 listings
> (~650 GetItem reads/day, far under limits). Two same-model SSDs drew
> duplicate-listing warnings — different physical drives, each listed with
> its own health report.
>
> Given the resolved false positive and a clean activity window, please
> review this hold and restore my payouts to the standard 2 days after
> delivery.

</details>

<details>
<summary>Rev 1 (980 chars, no Portage intro — superseded 09:16)</summary>

> I'm the account owner (username: [redacted]). All my payouts went on hold
> for 30 days as of Aug 8 — my second hold in 11 days. The July 28 hold was
> reviewed and resolved Aug 2 after I documented that the flagged activity
> was my own OAuth repair work on my registered developer application.
>
> This time I've audited my complete logs for the 24 hours before the hold:
> zero failed sign-ins, zero authorization errors, no account changes, no
> unfamiliar access. Only normal selling plus my app's new read-only status
> checks on my own 21 listings (~650 GetItem reads/day, far under limits).
> Two same-model SSDs drew duplicate-listing warnings — they're different
> physical drives, each listed with its own health report.
>
> Given the account history, the resolved false positive, and a fully clean
> activity window, I ask that this hold be reviewed and my payouts restored
> to the standard 2 days after item delivery. I'm glad to verify identity or
> provide logs for any window you need.

</details>

## Related

- [eBay Payment Hold (Jul 2026) — RESOLVED](/docs/ebay-support/ebay-payment-hold-2026-07)
- [Payout Hold #2 Investigation (Aug 2026)](/docs/ebay-support/payout-hold-2026-08-investigation)
- [eBay OAuth Environment & RuNames](/docs/reference/ebay-oauth-env)
- [eBay Account Security (ATO) & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening)
