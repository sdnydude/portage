---
title: "Deferral P4: docs & observability truth — ship-log generator revival, /about, rsync --delete, tutorials, eBay API reference"
sidebar_label: "Deferral P4: docs truth"
sidebar_position: 134
registry_id: 6315f965-af72-4f9d-afee-4935a2f50abb
---

# Deferral P4: docs & observability truth

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex (CI + web + docs + scripts, 5 registry items, 15 tasks) |
| **TDD** | yes (one test per write; 26 generator tests, 10 web tests) |
| **Branch** | `feat/p4-docs-truth` |
| **PR** | pending |
| **Registry items** | `2e2201ce` (+`f25bc5f5`) · `610ee575` · `db5e046a` · `2dcca6ef` · `b77e2423` |
| **Tests** | api 1033 · web 696 → 701 · generator 0 → 26 · e2e +1 |
| **Proof** | [2026-08-23 P4 docs truth](/docs/proof/2026-08-23-p4-docs-truth) |

## What shipped

- **Ship-log generator revived** (`.claude/scripts/shiplog/gen.py`, tested):
  paginates the registry (the old single `limit=100` fetch dropped the oldest
  34 sessions), escapes MDX braces and angle brackets in bodies while keeping
  frontmatter valid YAML, dedupes double captures, and is **additive** — every
  page carries `registry_id:`, hand-written pages are never regenerated or
  deleted, identity is resolved registry_id → pr_url → exact title → unique
  slug and anything ambiguous fails loud. Backfilled 74 missing sessions.
- **CI drift gate.** `deploy-docs.yml` runs `generate-ship-log.sh --check`
  before the copy step: git is the source of truth for pages, the registry for
  sessions, and a session with no committed page fails the deploy with the
  one command that fixes it. Decision: check mode over CI commit-back.
- **`rsync -a --delete`** for `website/static/img/` (trailing-slash source;
  dry-run against the live target showed zero orphans).
- **/about** — beta terms, AI-suggestion disclaimer, liability waiver,
  links to the full Terms/Privacy, contact; reachable from the publish
  disclaimer, avatar menu, sidebar and the More page; tab-bar clearance fixed
  on the legal pages too.
- **Tutorials** — "Listings tab" / "More tab" copy retired (4-tab truth), step
  ids renamed, all 24 PNGs re-captured on the rebuilt app; a new
  `check:tutorials` gate runs in CI (size, blank-frame, overlay bounds) and a
  test asserts every referenced screenshot exists.
- **eBay API reference** (`docs/api/ebay.md`): Trading lifecycle, REST call
  inventory, scopes, the RuName trap, account deletion, and an honest
  statement that there is no outbound retry/backoff today.

## Review rigor

Four plan advisors (24 findings folded before build), six review agents
(findings all fixed: `total`-less responses no longer silently truncate,
orphan deletion requires `--prune`, no-PR sessions never dedupe, pipes escaped
in tables, registry outage exits 3, body PR fallback reads only a labelled PR
line, 4-digit numbering and CRLF pages handled, `/about` nav icon and page
title, dead `GetMyMessages` row removed from the eBay doc).

## Operator decisions

- CI check mode, not commit-back (12:14 ET).
- /about copy approved with advisor additions (12:02 ET).
- Keep the 039–042 filenames (URL stability) rather than renumber.
