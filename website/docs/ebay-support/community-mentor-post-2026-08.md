---
id: community-mentor-post-2026-08
title: "Community Mentor Post (Aug 2026)"
sidebar_position: 7
---

# eBay Community — Mentor Request Post

Drafted 2026-08-08 for posting to an eBay community mentor. Public-forum
version: no login email, no application keyset, lighter identifying detail
than the [support email](/docs/ebay-support/ebay-payment-hold-2026-08).

---

**Subject: Two payout holds in 11 days, second one with no explanation. Trying to figure out what I'm tripping.**

Woke up this morning to all my payouts on hold for 30 days. Second time in 11
days, and this time I can't find a cause.

Some context on how I sell, because it's not the usual setup. I'm a software
developer, and I built an inventory app for cataloging personal belongings —
you photograph an item, it catalogs it, and when you want to sell it, the app
creates and manages the listing through the marketplace's official API. It's
registered through eBay's Developers Program. It's not launched yet; right
now I'm the only user, selling my own stuff through it, and it runs on a
server at my house, so all my API traffic comes from one IP.

The first hold, late July, was my own fault. I corrupted the app's OAuth
config while updating my server, and my repair attempts threw a bunch of
failed authorization calls at eBay in a short window, which I'm sure looked
like an account attack. I wrote support a full explanation and they released
it a few days later. No complaints there.

This one I can't explain. I log everything, and I went through the entire 24
hours before the hold: no failed sign-ins, no auth errors, no settings
changes, no logins from anywhere unusual. Just normal selling. A few new
listings, one promoted listing, and my app doing read-only status checks on
my own inventory.

Support won't tell me the reason. They said disclosing it is a security risk.
So all I have is what's in my own logs, and there are only two things that
were different that day:

1. I'd just turned on a feature in my app that polls my active listings a few
   times an hour to catch ended/sold status. All GetItem reads, ~650-700 a
   day across 21 listings. Nowhere near any limit, but it is a new pattern.

2. I listed two SSDs of the same model and got duplicate-listing warnings on
   the second one. They're different physical drives, each listed with its
   own health report. I've started putting the health % and hours in the
   titles so they don't look identical to the filter.

Questions, if you have time for any of them:

Does a resolved hold leave something behind on the account that makes the
next flag come easier? These two being 11 days apart doesn't feel like a
coincidence.

Does selling through your own app from one server IP make an account look
riskier in general? And if so, is there anything that helps besides time?

Do duplicate-listing warnings factor into payment holds at all, or is that a
separate system?

And is there anywhere to escalate a "we can't tell you why" hold to an actual
human review? Regular support just reads me the policy.

The money isn't the emergency, the pattern is. If I don't find out what's
tripping this, I'll be writing this same post again in two weeks.

Thanks.

---

## Short version (997 chars, peer/forum audience)

> Two payout holds in 11 days, the second with no reason given. The first
> (late July) was my fault: I sell my own belongings through an inventory app
> I built (registered eBay developer, official API, home server = one IP). I
> corrupted its OAuth config, and my repairs threw failed auth calls that
> looked like an attack. Explained it to support, hold released. Fine.
>
> This one I can't explain. My logs for the 24h before it: no failed
> sign-ins, no auth errors, no settings changes, nothing unusual. Only two
> new things that day: the app began read-only status polling of my 21
> listings (~650 GetItem/day, well under limits), and two same-model SSDs I
> listed drew duplicate-listing warnings — different physical drives, each
> with its own health report.
>
> Questions: does a resolved hold leave residue that makes the next flag
> easier? Does own-app, single-IP selling read as risky by itself? Do
> duplicate warnings feed payment holds? Any path to a human review when
> support can't disclose the reason?

## Superseded first draft (kept for the record)

<details>
<summary>Rev 1 (2026-08-08 08:40, replaced for tone at 08:42, app context added 08:44)</summary>

**Subject: Second 30-day payout hold in 11 days — no reason given, activity all documented. What would you do next?**

Hi — I'd really value your insight on a payout-hold situation, because I've
done everything I can from my side and I'm clearly missing something about
how eBay's risk process works.

The short version: I woke up this morning to find all my payouts on hold for
30 days. It's the second hold in 11 days. The first one (late July) I
understood — I'd had a genuine technical mess on my end: my selling app's
OAuth configuration got corrupted, and my repair attempts produced a burst of
failed authorization calls that I'm sure looked like someone attacking my
account. I wrote support a detailed explanation, and that hold was reviewed
and resolved within a few days. Fair enough — the system worked, I explained,
it got fixed.

This new one is different, and that's what has me stuck. This time there's
nothing anomalous to point at. I keep thorough logs, and I reviewed the full
24 hours before the hold: no failed sign-ins, no authorization errors, no
password or settings changes, nothing from any unfamiliar location. Just
normal selling — a few listings, one Promoted Listings campaign, and my
inventory app doing routine read-only status checks on my own listings.

Some background that may matter: I'm a software developer, and I sell through
an inventory application I built myself, registered through eBay's official
Developers Program. It runs from my home server, so my API traffic comes from
one consistent IP and always has. I'm aware this makes my account "look
different" from a typical seller's, and I suspect it's part of the story.

When I asked support for the reason for the new hold, they told me they can't
disclose it for security reasons — which I respect, but it leaves me guessing.
The only two candidate signals I found in my own logs:

1. The day before the hold, I deployed a new feature in my app that
   periodically checks my active listings' status (spread-out, read-only
   GetItem calls — roughly 650–700 a day across ~21 listings). New API
   pattern, but ordinary and well within limits.
2. I listed two SSDs of the same model — physically different drives, each
   with its own health report — and got "possible duplicate listing"
   warnings. I've since learned to differentiate the titles and condition
   descriptions per unit, which I'm fixing.

My questions for you:

- Have you seen back-to-back holds like this where the second seems to be
  residue from the first — a lingering risk score rather than a new finding?
  Is there any path to getting that reviewed as a pattern instead of two
  isolated events?
- Is there anything about the *way* I sell (own app via the Developers
  Program, single server IP, technical-looking account) that tends to trip
  risk systems, and anything sellers in my position do to establish trust?
- Do duplicate-listing warnings actually feed into payment-risk decisions,
  or are they purely a listing-policy matter?
- Is there a better escalation path than general support for "no reason
  disclosed" holds — one where a human can actually look at the account
  history?

I'm not trying to get anyone to bend rules — the July hold was legitimately
my own mess, and I said so. I just want to understand what the system is
seeing so I can stop tripping it. Any insight from your experience would be
hugely appreciated.

Thanks for reading this far.

</details>
