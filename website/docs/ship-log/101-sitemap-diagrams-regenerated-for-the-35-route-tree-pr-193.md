---
title: "Sitemap diagrams regenerated for the 35-route tree (PR #193)"
sidebar_label: "Sitemap diagrams regenerated for the 35-route tree"
sidebar_position: 101
slug: ship-822ec071
registry_id: 822ec071-a8e8-483b-989b-3ed64a4c3b80
generated: true
---

# Sitemap diagrams regenerated for the 35-route tree (PR #193)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [#193](https://github.com/sdnydude/portage/pull/193) |
| **Completed** | 2026-07-10 |
| **Model** | claude-fable-5 |

## Approach

gen_sitemaps.py route data updated: Login/Register cards replaced with Cloudflare Access gate card, /beta/report added, counts 34 to 35; full-landscape admin cluster shifted down 160px to clear card/card overlap the built-in checker cannot see (wires only); 3 SVGs regenerated 0 collisions; A3 PDF re-rendered via headless Chrome and visually inspected; tdd-guard bypass protocol used for the 2 diagram-card edits (Stephen ran disable, guard re-enabled + proven same turn)

## Commits

- d47e9d4 docs(sitemap): regenerate diagrams for the 35-route tree
- 9805e05 Merge pull request #193

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** generator exits 0 with 0 collisions x3; PDF rendered + inspected pre/post fix; live-verified post-deploy: SVG shows 35 pages + CF Access + beta/report, PDF 200, doc page updated
- **typecheck:** pass (CI 7/7)

**Tags:** `docs`, `sitemap`, `svg`, `diagrams`
