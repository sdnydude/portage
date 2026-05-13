---
title: "Fix Dependabot vulnerabilities + clean up website/ tooling"
sidebar_label: "Fix Dependabot vulnerabilities + clean up website/"
sidebar_position: 15
---

# Fix Dependabot vulnerabilities + clean up website/ tooling

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | — |
| **Completed** | 2026-05-11 |
| **Model** | claude-opus-4-6 |

## Approach

Remove unused Docusaurus tooling from website/ (eliminates vuln surface), fix static image deployment

## Commits

- `5e7cd01 fix: patch serialize-javascript CVE + copy static images in docs workflow`
- `08ff5d6 chore: remove unused Docusaurus tooling from website/`

**Tags:** `security`, `dependabot`, `docs`, `cleanup`

