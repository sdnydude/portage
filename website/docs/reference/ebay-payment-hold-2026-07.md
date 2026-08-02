---
id: ebay-payment-hold-2026-07
title: "eBay Payment Hold (Jul 2026) — RESOLVED"
sidebar_position: 4
---

# eBay Payment Hold — July 2026 Incident

:::tip Resolved
**Status: RESOLVED** (marked 2026-08-02 by the operator). The hold followed the
2026-07-26 → 07-28 OAuth environment incident — full technical background in
[eBay OAuth Environment & RuNames](/docs/reference/ebay-oauth-env). The support
email below was drafted 2026-08-01 to explain the flagged activity to eBay
support/security.
:::

## Context

The 07-26 Doppler resync corrupted the eBay OAuth configuration
(`EBAY_SANDBOX=true`, `EBAY_REDIRECT_URI` URL-instead-of-RuName). The 07-28
repair produced repeated failed OAuth authorization attempts against
`auth.ebay.com`, a disconnect/re-authorization of the app's account access
(completed 07-29), and API traffic from the g700data1 server IP — a pattern
eBay's risk systems read as possible account takeover, triggering a ~30-day
payment hold on seller funds. All activity was the account owner's own
troubleshooting; no third party was involved.

The dryrun matrix run on 2026-08-01 (PR #274) surfaced the hold as a standing
warning on every VerifyAddFixedPriceItem response: *"Funds from your sales may
be unavailable and show as on hold for a period of time."*

## Support email (as drafted 2026-08-01)

> **To:** eBay Customer Support / Account Security
> **Subject:** Payment hold following July 26–28 activity — explanation from account owner (activity was mine, issue resolved)
>
> Hello,
>
> I'm writing about the payment hold placed on my seller account on or around
> July 28, 2026. I believe the hold was triggered by unusual-looking
> authorization activity on my account during July 26–29. I want to explain
> exactly what happened, confirm that all of it was me — the account owner —
> and that the underlying issue is fixed.
>
> **Who I am.** My name is Stephen Webber. I own this eBay account (username:
> wdydvitosre, login email: swebber@me.com). I also run a small software
> company, Digital Harmony Group, and I sell on eBay through an
> inventory/listing application I built, which connects to my account through
> eBay's official Developers Program OAuth flow (application keyset beginning
> `DigitalH-click2li-PRD`). This app has been listing and selling on my
> account normally since June 2026.
>
> **What happened.** On July 26, a fault in my configuration-management system
> corrupted the application's settings: the OAuth redirect value (RuName) was
> overwritten with an invalid placeholder, and the app was accidentally
> pointed at eBay's sandbox environment instead of production.
>
> On July 28, I diagnosed and repaired this. The repair process is what likely
> looked suspicious from the outside:
>
> - Several **failed OAuth authorization attempts** against auth.ebay.com
>   (they returned `invalid_request` until I isolated the bad redirect value).
> - A **disconnect and re-authorization** of my app's access to the account,
>   completed July 29.
> - Application API traffic originating from my **home server's IP address**,
>   which differs from the IP of the devices I browse eBay from. This is the
>   normal architecture of my setup — the server makes API calls on my behalf
>   — and has been the pattern since June.
>
> **All of this activity was me.** No third party accessed or attempted to
> access my account. My password was never compromised, and my account
> credentials and two-factor setup are intact. The failed sign-in/authorization
> attempts were my own troubleshooting of my own application's
> misconfiguration.
>
> **It is fixed.** The root cause (the corrupted configuration values) was
> identified and corrected on July 28, the working configuration was restored
> and verified, and I added an automated startup safeguard to my application
> so this class of misconfiguration cannot recur silently. The incident is
> fully documented in my company's internal engineering records, which I'm
> happy to share.
>
> **My request.** Given that the flagged activity was legitimate owner
> activity and the cause is resolved, I'd ask that you review the payment hold
> placed on my account and release it, or shorten the 30-day period. I'm glad
> to verify my identity by any means you need — phone, ID verification, or
> confirming recent account activity.
>
> Thank you for your time and for the security monitoring — it did its job;
> this just happens to be the false-positive case.
>
> Stephen Webber

## Related

- [eBay OAuth Environment & RuNames](/docs/reference/ebay-oauth-env) — root
  cause, RuName trap, recovery checklist
- [eBay Account Security (ATO) & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening)
  — why user-IP ≠ server-IP is normal and what actually trips ATO signals
