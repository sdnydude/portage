---
title: "2026-08-23 — Deferral P4: docs & observability truth"
description: "Proof-of-done bundle: ship-log generator revived and backfilled with a CI drift gate, /about reachable from every surface, tutorials re-captured on the 4-tab app, eBay API reference"
---

# Proof of Done — Deferral P4: docs & observability truth

Captured 2026-08-23 against `portage-app` rebuilt from `feat/p4-docs-truth`
and a CI-replica Docusaurus build of this branch served on `:8017`. Live
items that depend on the merged deploy (rsync probe removal, CI gate run,
registry KB hit for `ebay.md`) are recorded in the ship-log entry after merge.

## Ship-log generator

- Registry: 134 sessions (newest-first, paginated). The old generator fetched
  `limit=100` once — it silently dropped the oldest 34 and renumbered the rest.
- Backfill: 74 pages created, 59 existing pages stamped with `registry_id:`
  (frontmatter-only; bodies byte-identical), 2 old generator duplicates
  removed (same sessions as hand-written pages), 1 duplicate registry row
  deleted (backup in `docs/registry-backups/`). At backfill: 134 pages =
  133 sessions + 1 hand-written page with no registry row. After this ship's
  own session was posted and its page stamped: 135 pages = 134 sessions + 1.
  Three stale generator duplicates of hand-written pages (040-voice…, 052-,
  054-) were removed — their sessions keep the richer hand-written page.
- `--check` (CI drift gate): in sync on the final tree; a second full run
  changes nothing; exit codes 1 drift / 2 ambiguous / 3 registry unreachable.
- The replica build caught a real bug: MDX escaping applied to YAML
  frontmatter (`-\>`), fixed with YAML quoting. A fixture page titled
  `Fixture {expr} title <11B tag> test` rendered as literal text in the built
  HTML — the escaping works through the real build.
- Index: 134 links on the built `/ship-log/` page at backfill (135 once the P4 page was stamped).

## /about

![Mobile 375](/img/verification/p4/about-mobile-375.png)
![Desktop](/img/verification/p4/about-desktop-1280.png)
![Avatar menu](/img/verification/p4/avatar-menu-about-desktop.png)
![More page link](/img/verification/p4/more-about-link-mobile.png)

Reachable from the publish disclaimer, the desktop avatar menu, the sidebar,
and the More page (the only mobile path — advisors caught that the first plan
had none). The Contact section clears the floating tab bar on a 375 px phone;
the same clearance fix landed on `/legal/terms` and `/legal/privacy`.

## Tutorials

All 24 screenshots re-captured on the rebuilt app; `check-tutorial-captures`
(now a CI step) passes every step: correct size, not a blank frame, overlays
on-canvas. Renders of the three topics whose copy changed:

![Listings step 1](/img/verification/p4/listings-step1.png)
![Settings step 1](/img/verification/p4/settings-step1.png)
![Messages step 1](/img/verification/p4/messages-step1.png)

## eBay API reference

`/api/ebay` builds and serves on the replica (RuName paragraph present); the
registry KB hit is checked after the merged deploy ingests it.

## After merge (PR #319, `efdf4bd`, 2026-08-23 14:08 ET)

- First `deploy-docs` run on `main`: drift check **in sync**, Docusaurus build
  green, pre-restart smoke gate passed, rsync itemized log added the 14 new
  proof images with **zero deletions**, registry ingest 1,982 chunks.
- Live: `/portage/ship-log/` lists **135** entries; `/portage/api/ebay/`
  serves with the RuName section; KB search for the RuName trap returns the
  new page; tutorials PNGs served from the rebuilt app; prod `/about` answers
  behind Cloudflare Access.
- **Failure drill:** `workflow_dispatch drill=true` failed the run at step 1
  and the alarm opened issue #320 automatically with the run link and fix
  instructions; the site kept serving; issue closed as a drill.
