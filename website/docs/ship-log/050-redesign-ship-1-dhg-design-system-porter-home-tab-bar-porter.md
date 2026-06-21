---
id: redesign-ship-1-build
title: "Redesign Ship 1 — DHG design system + Porter home + tab bar + /porter page + theme toggle"
sidebar_label: "Redesign Ship 1 — DHG design system + Porter home "
sidebar_position: 50
---

# Redesign Ship 1 — DHG design system + Porter home + tab bar + /porter page + theme toggle

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | — |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Hybrid DHG token adoption (swap neutrals app-wide, add teal/orange/graphite accents, migrate forest-green per screen); 4-ship breakdown; 2x adversarial advisor review per chunk; tdd-guard suspended for apps/web (screenshot-gated)

## Commits

- `a5a3aa9 T1 DHG tokens light+dark+@theme`
- `163a49d T2 real /porter page (SSE streaming)`
- `79817b4 T3 tab bar 6+Scan`
- `d202f81 T4 graphite home hero + wired mic`
- `c14231e T5+T6 value band + listings`
- `513e037 T7 staggered entrance + a11y`
- `09c76ad T8 light/dark theme toggle`

## Deferred Items

- Phase 6 review + Phase 7 PR remain
- Post-merge: remove EXTRA_CORS_ORIGINS=:3003 from override.yml + re-enable tdd-guard apps/web
- Ships 2-4: scan-review redesign, pricing engine, eBay-setup nav + dynamic condition

## Decisions

- Hybrid DHG scope
- Porter tab as real page reusing FullChat
- Theme toggle via .dark class + pre-paint init script over media query

## Verification

- **lint:** 0 errors (25 pre-existing warnings)
- **tests:** n/a (UI, tdd-guard suspended)
- **typecheck:** pass

**Tags:** `redesign`, `dhg`, `dark-mode`, `tab-bar`, `porter`, `ship1`

