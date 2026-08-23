---
title: "App sitemap in docs: 3 SVG variants + PDF + generator with collision checking; docs-site outage fix"
sidebar_label: "App sitemap in docs: 3 SVG variants + PDF + genera"
sidebar_position: 87
slug: ship-5798cdeb
registry_id: 5798cdeb-4a31-4461-a376-5f829d9f5244
generated: true
---

# App sitemap in docs: 3 SVG variants + PDF + generator with collision checking; docs-site outage fix

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | — |
| **PR** | [#156](https://github.com/sdnydude/portage/pull/156) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

gen_sitemaps.py (versioned, website/scripts/) generates landscape / admin-collapsed / vertical from route data and machine-verifies zero wire-over-card collisions (samples wires vs card bboxes incl. labels, attach-exempt, exit 1 on violation — replaced eyeballing after user mandate). A3 PDF via Playwright. Docs page architecture/sitemap using the /portage/img mount. Shipping surfaced TWO latent pipeline bugs: (1) deploy-docs copied only top-level img/*.svg — subdirs (verification screenshots) never shipped, now recursive; (2) ship-log 039 plain-text \{stream:true\} broke every MDX build — 5 silent deploy failures on 2026-07-02 and a clobbered build dir took the docs site to 500 site-wide; escaped 039+053 (PR #157) and restored. Also fixed PR #155 shutter-flash setTimeout leak (vitest exit-1 flake).

## Commits

- PR #156 sitemap + workflow fix + flash-timer fix
- PR #157 ship-log MDX escapes

## Deferred Items

- ship-log generator brace escaping + deploy failure notifications + build-dir protection (high)
- nginx trailing-slash 301 drops :8017 port (low)

## Decisions

- collision checking is part of the generator (exit 1), not a manual review step

## Verification

- **lint:** clean
- **tests:** CI green both PRs; deploy success; live 200s for page + 3 SVGs + PDF + verification PNGs
- **typecheck:** pass

**Tags:** `docs`, `sitemap`, `docusaurus`, `outage`, `mdx`
