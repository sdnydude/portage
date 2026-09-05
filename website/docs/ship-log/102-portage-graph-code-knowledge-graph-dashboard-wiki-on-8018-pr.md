---
title: "portage-graph: code knowledge graph dashboard + wiki on :8018 (PR #200)"
sidebar_label: "portage-graph: code knowledge graph dashboard + wi"
sidebar_position: 102
slug: ship-82413ee4
registry_id: 82413ee4-e462-4c1e-adde-2125eeedfda4
generated: true
---

# portage-graph: code knowledge graph dashboard + wiki on :8018 (PR #200)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#200](https://github.com/sdnydude/portage/pull/200) |
| **Completed** | 2026-07-11 |
| **Model** | claude-fable-5 |

## Approach

nginx:alpine compose service serving graphify-out/ read-only (graph.html index, autoindex, .md text/plain MIME fix), versioned conf in infra/, docs page in Docusaurus (deployed), CLAUDE.md ports row; graph freshly synced (incremental --update: 418 files, 2536 nodes/3819 edges/328 communities, gemini ~355k tokens, 211s); wiki export deterministic (339 files, 0 LLM tokens, 0.12s)

## Commits

- 6fdce8a feat(infra): portage-graph service
- 6d4b098 Merge pull request #200

## Decisions

- Gemini stays graphify extraction backend (bulk read-and-summarize, ~50x cheaper than Fable; wiki export needs no LLM at all)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** live-verified: :8018 / + graph.html + GRAPH_REPORT.md + wiki/index.md all 200, md text/plain; docs page 200 post-deploy
- **typecheck:** pass (CI 7/7)

**Tags:** `graphify`, `knowledge-graph`, `nginx`, `dashboard`, `wiki`
