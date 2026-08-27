---
title: "Deferral P6 — dependency majors: Node 24, TypeScript 6, vitest 4, zod 4, pino 10, ESLint 10 (composed plugin stack)"
sidebar_label: "Deferral P6 — dependency majors: Node 24, TypeScri"
sidebar_position: 139
slug: ship-58f04bb2
registry_id: 58f04bb2-d2b6-4a1f-8424-b87246fc0c55
generated: true
---

# Deferral P6 — dependency majors: Node 24, TypeScript 6, vitest 4, zod 4, pino 10, ESLint 10 (composed plugin stack)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#336](https://github.com/sdnydude/portage/pull/336) |
| **Completed** | 2026-08-27 |
| **Model** | claude-fable-5 |

## Approach

Plan §P6 with verified substitutions: TS 6 not 7 (typescript-eslint peer \<6.1), Node 24 runtime + types, eslint-config-next replaced by @next/eslint-plugin-next + @eslint-react + react-hooks + jsx-a11y + import-x after operator no-deferral directive; per-step commits with lockfile snapshots; gates typecheck/lint/1064 api/710 web/audit 0 high/fresh npm ci; live smoke on deployed branch; 3-agent review, 22 findings all fixed

## Commits

- 01ad9b1 chore(deps): npm audit fix — 0 high, next 16.3.3, postcss override ^8.5.23
- 5d105c3 chore(deps): TypeScript ~6.0.0 across workspaces; web tsconfig types node
- b0aa42d chore(runtime): Node 24 — Dockerfiles, CI, .nvmrc, engines; api @types/node 24
- 2b26ae4 chore(deps): vitest 4 — constructor-style mocks, spyOn history, web reporter dep
- 02efff7 chore(deps): zod 4 — issues/record/partialRecord/guid/url/flattenError
- aec6b8d chore(deps): pino 10 + pino-http 11 — redaction re-proven
- 6749056 chore(deps): eslint 10 — composed plugin stack replaces eslint-config-next
- 63b407f refactor(web): satisfy @eslint-react recommended — keys, ref names, React 19 context
- 0acb32e chore(ci): dependabot ignores for TS \>=6.1 and @types/node \>=25
- 32652b8 docs: P6 proof page + CLAUDE.md stack facts
- 1651e89 fix(deps): eslint root devDep, jsx-a11y peer in lock, dependabot web range, CI lint canary
- f73a786 fix(web): review round — highlight timer, withKeys list keys, hook lint sites, +7 tests
- 2c2015a docs: CLAUDE.md P6 paragraph corrections

## Decisions

- TS ~6.0 pinned (7 dropped compiler API; typescript-eslint peer \<6.1)
- Node 24 LTS runtime instead of holding @types/node at 20
- ESLint 10 built via composed stack; a11y kept by force-recording jsx-a11y eslint-9 peer in lockfile with eslint as root devDep
- z.guid() over strict z.uuid() to preserve v3 permissiveness
- z.partialRecord for enum-keyed limitOverrides (v4 exhaustive records)
- withKeys() occurrence-suffix helper instead of index keys
- no-leaked-conditional-rendering left off (needs typed linting — separate decision)

## Review

- Agents: silent-failure-hunter, code-reviewer, pr-test-analyzer
- Critical found: 0 · Important found: 8

## Verification

- **lint:** 0 errors / 27 warnings (baseline)
- **tests:** api 1064/1064, web 710/710
- **typecheck:** pass (3 workspaces)

**Tags:** `dependencies`, `node24`, `typescript6`, `vitest4`, `zod4`, `pino10`, `eslint10`, `deferral-program`, `p6`
