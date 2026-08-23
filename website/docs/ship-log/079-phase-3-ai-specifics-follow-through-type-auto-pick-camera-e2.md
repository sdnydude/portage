---
title: "Phase 3: AI-specifics follow-through (Type auto-pick, camera e2e, SKU proof, E-panel closure)"
sidebar_label: "Phase 3: AI-specifics follow-through (Type auto-pi"
sidebar_position: 79
slug: ship-3ab4ee8f
registry_id: 3ab4ee8f-1ab3-470a-9e1d-4f5a5ebe2424
generated: true
---

# Phase 3: AI-specifics follow-through (Type auto-pick, camera e2e, SKU proof, E-panel closure)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#147](https://github.com/sdnydude/portage/pull/147) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

Worktree branch per protection model. Decisions: E-panel superseded by inline [AI] chips (PR #132 consumer), plan-doc PR #126 closed unmerged. 3.4: aspect-pick.ts constrained second pass inside generateListingFields (TDD, 7 tests) — live probe vs real LLM caught huge-enum+512-maxTokens empty-content bug, fixed with 120-value cap + 2048 tokens, then live-proven picking Form Factor from real 19-value enum. 3.3: camera e2e via canvas.captureStream getUserMedia polyfill (plain-HTTP has no mediaDevices), mocked AI boundary, real save asserted after reload + cleanup. 3.5: SKU proven in eBay record via GetItem (PRT-000016/17) — no new publish needed.

## Commits

- 4b5dbae docs E-panel superseded
- b38653c feat(api) aspect pick pass
- 86804b8 test(e2e) camera scan-save
- 9ce2210 chore GetItem SKU probe
- c25d378 docs burndown 3.3-3.5
- ba89a89 fix(api) enum cap + maxTokens

## Decisions

- E-panel superseded by inline AI chips; PR #126 closed unmerged
- Pick pass caps enums at 120 values — huge suggestion lists are not classification tasks
- SKU check via GetItem on ended listings instead of publishing a fee-incurring test listing

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** api 544 + web 225 + e2e camera/porter green; CI 6 checks green
- **typecheck:** pass

**Tags:** `phase-3`, `aspects`, `camera-e2e`, `sku`
