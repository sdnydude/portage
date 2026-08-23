---
title: "Docs site refresh: full staleness sweep + screenshot appendix + deployed-image-path fix (PR #191)"
sidebar_label: "Docs site refresh: full staleness sweep + screensh"
sidebar_position: 100
slug: ship-2253e8af
registry_id: 2253e8af-254a-4675-9c63-1d58af01a334
generated: true
---

# Docs site refresh: full staleness sweep + screenshot appendix + deployed-image-path fix (PR #191)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | — |
| **PR** | [#191](https://github.com/sdnydude/portage/pull/191) |
| **Completed** | 2026-07-10 |
| **Model** | claude-fable-5 |

## Approach

3 parallel agents swept 34 core pages verified against code (CF Access auth, Trade-First, Etsy parked, carrier/voice removal, rembg BG removal, Gemini vision chain, baked-image deploy); 117 root screenshots committed to website/static/img/screenshots with date-grouped appendix gallery; deploy-docs.yml gained \](/img/ to \](/portage/img/ rewrite fixing sitewide 404 doc images; 2 ship-log index links fixed (filenames vs frontmatter ids, broke build); local Docusaurus build validated pre-merge; CLAUDE.md files corrected (rembg, vision chain, 6-tab, 6 settings pages)

## Commits

- 4c630bf docs(site): full staleness sweep, screenshot appendix, image-path fix
- 0b0ceae Merge pull request #191

## Deferred Items

- Regenerate sitemap SVGs via gen_sitemaps.py — route tree now 35 pages / 11 admin vs diagrams 34/10

## Review

- Agents: general-purpose x3
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** CI pass; local Docusaurus build success; live-verified post-deploy: appendix 200 with 117 imgs, sample img 200, auth page shows CF Access, previously-404 verification img now 200
- **typecheck:** pass (CI 7/7)

**Tags:** `docs`, `docusaurus`, `screenshots`, `appendix`, `deploy`
