---
title: "Seller-profile Business Policies removal + CodeRabbit follow-up fixes"
sidebar_label: "Seller-profile Business Policies removal + CodeRab"
sidebar_position: 95
slug: ship-0a538737
registry_id: 0a538737-68c9-42e7-8fad-0455db44b62b
generated: true
---

# Seller-profile Business Policies removal + CodeRabbit follow-up fixes

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#186](https://github.com/sdnydude/portage/pull/186) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

Screen de-policied w/ explicit ship-from save; dead-era sweep folded in per correction; resume-race fixed via conditional claim UPDATE; parked-sync PATCH reports saved+warning; legal copy tightened

## Commits

- be9758e seller-profile UI cleanup
- 9d82e99 dead Business Policies machinery
- 1d6b853 resume race + parked-sync truth + legal copy

## Deferred Items

- self-heal block unwind (32-test positional-mock refactor, registry-tracked)

## Decisions

- refresh UPDATE doubles as atomic resume claim; MARKETPLACE_UNSUPPORTED on PATCH = saved+warning not 400 (write precedes sync)

## Review

- Agents: coderabbit
- Critical found: 0 · Important found: 2

## Verification

- **lint:** clean
- **tests:** 654 api + 285 web (post-merge main); live 404s + bundle grep on 185
- **typecheck:** pass

**Tags:** `business-policies`, `coderabbit`, `idempotency`, `race`
