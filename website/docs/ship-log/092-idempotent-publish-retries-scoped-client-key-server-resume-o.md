---
title: "Idempotent publish retries — scoped client key + server resume of stuck drafts"
sidebar_label: "Idempotent publish retries — scoped client key + s"
sidebar_position: 92
slug: ship-aa899e68
registry_id: aa899e68-9d96-4447-8cc1-129837b94ea0
generated: true
---

# Idempotent publish retries — scoped client key + server resume of stuck drafts

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#180](https://github.com/sdnydude/portage/pull/180) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

TDD both sides: client key scoped itemId:marketplace:random in flow state (rides drafts) + CreateListingSheet ref; server 23505 replay resumes unpublished-draft rows (refresh from body + adapter publish); DrizzleQueryError cause-code fix revived the dead replay path

## Commits

- f60e924 fix(api): resume publish on idempotency-key replay of stuck draft
- 9def649 fix(web): scoped idempotencyKey on publish stops orphan drafts
- ab61345 fix(web): CreateListingSheet sends the scoped idempotencyKey too
- 857f118 fix(api): read the 23505 code from e.cause — drizzle wraps driver errors

## Decisions

- scoped key embeds its own scope in one field; server resume-on-replay required for stable-key correctness

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 608 api + 281 web + e2e 20/20 vs ephemeral stack; live double-POST proof
- **typecheck:** pass

**Tags:** `idempotency`, `publish`, `retry`, `drizzle`
