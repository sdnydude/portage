---
title: "4-tab bottom nav + app shell on /admin"
sidebar_label: "4-tab bottom nav + app shell on /admin"
sidebar_position: 115
slug: ship-dae29f08
registry_id: dae29f08-95c6-47cd-8a2e-38b420331a52
generated: true
---

# 4-tab bottom nav + app shell on /admin

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#240](https://github.com/sdnydude/portage/pull/240) |
| **Completed** | 2026-07-17 |
| **Model** | claude-fable-5 |

## Approach

TDD retruth of nav/layout tests (one test per edit); BAR_TABS 5→4 drives TabBar+sidebar; AppShell admin carve-out removed with two minimal admin-layout adjustments; pre-existing TopBar sticky no-op fixed on the wrapper; live-verified via throwaway dev-API auth recipe + Playwright against rebuilt container

## Commits

- 5071528 feat(web): 4-tab bottom nav — remove Listings from BAR_TABS
- f17f586 feat(web): mount the app shell on /admin + fix the sticky TopBar no-op

## Deferred Items

- Tutorial/onboarding PNG + sitemap SVG regeneration (5-tab bar visible) + tutorials/listings.ts copy before next tutorial publish

## Decisions

- BAR_TABS stays the single source of truth — Listings leaves the desktop sidebar along with the mobile bar, flagged in PR for review

## Verification

- **lint:** clean (0 errors)
- **tests:** API 687/687, web 527/527, workbench e2e 10/10 vs rebuilt container
- **typecheck:** pass

**Tags:** `nav`, `tab-bar`, `admin`, `app-shell`, `sticky`
