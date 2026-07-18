# Plan: Land the 2026-07-17 docs-refresh tree

**Status:** DRAFT — awaiting Stephen approval. Phase 0 (adversarial tree review) running; its findings finalize Phase 1 scope.
**Scope:** the uncommitted working tree (57 M / 14 D / 36 ??, all docs/SVG/env-template, zero runtime code) + local commit `aebf33c`, produced by the 4-prompt docs program. Goal: review-gated landing on main, public deploy, cleanup-pass completion.

---

## Phase 0 — Adversarial tree review (IN PROGRESS)

Fable review agent sweeping every changed/new path: factual claims vs code (vision chain, marketplaces, ports, nav), zero-defect publication gate (placeholders/test data/creds/dead links), all 14 new SVGs edge-verified vs compose/infra, deletion-safety grep, explicit coverage statement. Trigger: the escaped README-intro defect proves pass output can't be trusted un-reviewed.

**Artifact:** findings report written to `docs/audits/2026-07-tree-review-findings.md` on agent completion — ranked by severity, each finding with file:line + contradicting ground-truth evidence + suggested fix, plus deletion-safety verdict, SVG verdict, and explicit coverage statement (N of M paths reviewed, skips named). Phase 1 executes from that file only.

**Gate:** no commit until every public-facing factual finding is fixed or explicitly accepted by Stephen.

## Phase 1 — Fix findings

1. Known: README intro paragraph — eBay+**Reverb** (not Etsy), AI vision chain Gemini-primary (not "Claude Vision"), drop one-tap multi-marketplace claim, "responsive mobile-first". E1 skip re-scoped to Q3 nav-wording only.
2. All Phase 0 findings, same standard: verify fix against code, editor-style second read on each touched paragraph.

## Phase 2 — Cleanup-pass items folded into this landing (Q-verdict-unblocked)

Small, docs-only, land with the same branch:
- Q3 (docs follow code, 5-tab + Scan): E4, E7, G1, E36 app-structure stamp, root+web CLAUDE.md wording
- Q1: run `npm run test:api` + `test:web`, recount tasks, stamp E6/E24 files with real numbers
- Q4: move 76 unlinked verification PNGs website/static/img → docs/verification-archive/ (not deployed); the 14 new docs-refresh proofs stay (referenced)
- Q5/Q6: delete docs/screenshots dupes + docs/superpowers memory-svg twins (website side canonical); G6 count updates
- Q11: add session_reports to registry-integration.md + KB-search rule source table
- Q9: document the /docs/ sed-rewrite convention where it lives
- E15 (style-guide, Q7 verdict: stays, front-matter scope note), E33, G3, G7 per verdicts

**Explicitly NOT in this landing** (registered deferred, separate workstreams):
- Ship-log generator revival + 54-session backfill + SOP/hooks (Stephen directs; E31 + E28 ship-log sub-item ride with it)
- Q8 rehearsal:3004 ingress delete, :8018 landing → /explore/ (infra, need go)
- @imgly dep removal + schema.ts:5–6 comment (code PR)
- G9 (waits on PR #237 merge); demo creds in .claude/skills/frontend-verification (config scope)

## Phase 3 — Git strategy

1. `git branch docs/2026-07-refresh` at current HEAD (captures `aebf33c`), then reset local main to origin/main (`git reset --hard 566e374` — safe: all work is in the working tree/branch; stash-first rule honored by branching before reset, working tree carries over).
2. Commit on the branch in reviewable slices: (a) corrections to existing docs, (b) deletions, (c) new pages + SVGs + sidebars, (d) program artifacts (audits/, prompts/, session report, infra/graph-explore/, research/), (e) cleanup-pass items.
3. Push, open PR. Conflict check first against open PRs #236 (docs/session-wrap-0715 — overlapping docs paths likely) and #237; if #236 conflicts, propose merging #236 first — Stephen's call.
4. Merge `--no-ff` on green CI. No co-author trailers.

**Risk:** `[no-secrets]` write-hook already forced one filename and may re-fire on `infra-secrets-path*.svg` commit — if it false-positives, stop and show Stephen the hook output; no bypass without approval.

## Phase 4 — Deploy + verify (DoD)

Merge to main triggers deploy-docs.yml (build → nginx restart → registry ingest → verify) on the self-hosted runner. Then: live spot-check 10.0.0.251:8017 — README-equivalent landing, new infrastructure section, Trade-First reference, 3 new API pages, both themes on 3 diagrams; screenshot proof. Registry doc_pages count re-checked post-ingest (319 → expect growth).

## Phase 5 — Post-land

`graphify update .`; TODO.md + CLAUDE.md Progress stamps; memory update (docs program CLOSED); session capture per rules; verify commit `aebf33c` content landed via the branch (it will — branch carries it).

---

## Approval asks (answer any/all)

1. **Approve plan?** (Phases 1–5 execute on your go; Phase 0 already running on your "auto" instruction.)
2. **PR #236 ordering** if conflicts: merge #236 first, or rebase this branch over it?
3. Standing go-decisions unchanged: Q8 ingress delete, :8018 landing swap — separate from this landing.
