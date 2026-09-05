---
title: "Publish claim race — publishClaimedAt claim, selective release, stale-claim SKU adopt, /:id/publish claim, stuck-claim sweep, web in-flight guard"
sidebar_label: "Publish claim race — publishClaimedAt claim, selec"
sidebar_position: 138
slug: ship-8ecd3f27
registry_id: 8ecd3f27-cf23-4e78-a41f-3d933a23404d
generated: true
---

# Publish claim race — publishClaimedAt claim, selective release, stale-claim SKU adopt, /:id/publish claim, stuck-claim sweep, web in-flight guard

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#331](https://github.com/sdnydude/portage/pull/331) |
| **Completed** | 2026-08-27 |
| **Model** | claude-fable-5 |

## Approach

Investigated 08-25 eBay Promote-section report (eBay-side) then found the real bug behind 08-26 duplicate: six same-key POSTs passed the R3 resume claim. Two advisors (design/risk + fact-check) before build; TDD one-test-per-edit; adversarial review 3 findings fixed pre-commit; live PoD on real eBay account (3-burst → 1 listing + 2×409; draft 2-burst → 1 + 409) + Playwright FE proof against rebuilt app.

## Commits

- 66e1909 fix(listings): publish claim — serialize concurrent publishes, adopt-or-release stale claims
- a79d9a5 docs(proof): publish claim race live PoD
- test(e2e): publish-claim double-tap proof + screenshots

## Decisions

- publishClaimedAt timestamp claim over pg advisory lock (pins a pooled connection across the eBay call) and over a publishing enum value (UI-facing status, sync worker filters on it)
- release claim only on AppError|EbayTradingError; raw network errors keep the stamp — create may have landed
- stale takeover (\>5 min) rechecks eBay by items.ebaySku via GetMyeBaySelling and adopts; Reverb has no SKU carriage → release + warn

## Review

- Agents: feature-dev:code-architect, feature-dev:code-explorer, feature-dev:code-reviewer
- Critical found: 1 · Important found: 1

## Verification

- **lint:** clean (27 pre-existing warnings)
- **tests:** api 1060/1060, web 704/704, e2e publish-claim-race 1/1
- **typecheck:** pass

**Tags:** `ebay`, `idempotency`, `race`, `double-publish`, `publish-claim`
