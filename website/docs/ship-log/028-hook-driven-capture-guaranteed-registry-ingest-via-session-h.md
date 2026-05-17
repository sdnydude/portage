---
title: "Hook-driven capture — guaranteed registry ingest via session hooks"
sidebar_label: "Hook-driven capture — guaranteed registry ingest v"
sidebar_position: 28
---

# Hook-driven capture — guaranteed registry ingest via session hooks

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/68](https://github.com/sdnydude/portage/pull/68) |
| **Completed** | 2026-05-16 |
| **Model** | claude-opus-4-6 |

## Approach

Python Stop hook parses session JSONL, count-based gap detection for insights + binary check for ship sessions

## Commits

- `72817c4 fix: use correct CLAUDE_CODE_SESSION_ID env var in capture hooks`
- `63b8f8e feat: add capture-guarantee Stop hook for guaranteed registry ingest`
- `5475916 fix: address review findings in capture-guarantee hook`

## Deferred Items

- V2: Decision detection (needs NLU)
- V2: Bug-fix detection (freeform text)
- V2: Corrections and deferred-items detection

## Decisions

- Count-based over content-matching (paraphrases make matching infeasible)
- Python over bash (JSONL parsing requires structured data handling)
- Gut rules to stubs rather than delete (preserve real-time capture guidance)

## Review

**Agents:** silent-failure-hunter, code-reviewer, code-simplifier
**Critical issues found:** 2
**Important issues found:** 5

## Verification

- **lint:** clean
- **tests:** 141/141 pass
- **typecheck:** pass

**Tags:** `hooks`, `registry`, `capture`, `infrastructure`, `automation`

