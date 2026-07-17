# 2026-07-17 — Docs audit program: 4-prompt refresh + graphify explorer

## The story

Session started as a prompt rewrite: Stephen asked to turn a rough docs-audit request into proper prompts. Result: a 4-prompt program in `prompts/` — 001 read-only audit, 002 edit/update pass, 003 new sections + infra + differentiation graphics, 004 graphify dashboard interface. All prompts encode Stephen's standing rules: sources of truth ordered code → merged PR notes → CodeGraph → graphify → Registry KB; grep only for non-code/string sweeps; never guess, UNVERIFIED + ask instead; all agents on Fable (`model: "fable"` explicit — overrides the sonnet-subagent memory for this program).

Execution: 001–003 sequential, 004 parallel. Three completed in-session:

**001 audit** — 564 files = 564 verdict rows (mechanical disk-walk reconciliation), 7 parallel Fable subagents. Outputs: `docs/audits/2026-07-docs-audit.md` (master, §9 = 15 open questions) + `2026-07-docs-audit-worklist.md` (36 EDIT / 9 GRAPHICS / 6 NEW). Headline defects: both architecture SVGs teach the deleted password-auth/Etsy/carrier era; README wrong end-to-end; committed demo credentials in README/ONBOARDING/docs/TODO; 13 undocumented API route groups; post-R0 shell contradicted in 5 files; false client-side-WASM bg-removal claims; ship-log pipeline dormant (54/109 sessions missing).

**004 graphify explorer** — SHIPPED live at 10.0.0.251:8018/explore/. Research proved `graphify update .` regenerates graph.html (direct edits = guaranteed loss), so the interface is a separate self-contained layer in `graphify-out/explore/graph.html` fetching `../graph.json` at runtime — survives regeneration, auto-current. Tracked copy: `infra/graph-explore/graph.html` (graphify-out gitignored); deploy = cp. Verified live: 6-node click-through, real regeneration mid-test (graph grew to 4,717 nodes), stale-cache defect caught+fixed (`cache:"no-cache"`). Log + 11 screenshots: `docs/audits/2026-07-graphify-interface*`.

**002 edit pass** — 25/36 EDIT done, 3 partial, 8 skipped (all skips tagged to open questions — no silent drops); 3/9 GRAPHICS. Demo credentials stripped (docs now point to Doppler). Build verified for real: scratchpad mirror of aifactory3.5 docs-site replicating deploy-docs.yml (both sed rewrites + img copy), `docusaurus build` exit 0 with `onBrokenLinks: 'throw'`. Stale-marker sweep clean. 79 working-tree paths changed, UNCOMMITTED, awaiting Stephen review. One commit made on main by the agent: `aebf33c` (5 pre-existing untracked session docs, per worklist E34) — local, unpushed, keep-or-reset is Stephen's call.

**003** — COMPLETED post-wrap (05:24). 12 new pages: `reference/ebay-trade-first.md` (the audit's highest-value gap), `frontend/responsive-shell.md`, `frontend/porter.md`, 3 API pages closing the 13-route-group gap (messages, seller-profile, platform — built from route handlers + Zod), and a new 6-page Infrastructure section (overview, services runbook, cloudflare, ci-cd, secure-config-and-storage). 14 SVGs = 7 light/dark pairs (auth flow, 18-table ER, AI pipeline, infra topology + request/deploy/secrets paths), every edge verified before drawing, zero orphans. Build exit 0 twice with `onBrokenLinks: 'throw'`; 14 visual proofs inspected at `website/static/img/verification/docs-refresh/`. Worklist: N1–N5 done, N6 partial (README pitch Q3-blocked), G8 done. Log: `docs/audits/2026-07-new-content-log.md`. Flags: a `[no-secrets]` write-hook forced the `secure-config-and-storage.md` filename (URL kept via frontmatter id; hook may re-fire when committing `infra-secrets-path*.svg`); pre-existing api/ sidebar position collisions; stale Inventory-era comment `schema.ts:5–6` → code session.

**15 open questions answered** (verdicts in-session, transcript + below). Stephen overruled Q2: ship-log generator is NOT retired — REVIVE it (stable-id numbering, stale-file cleanup, pr_url validation, registry dedup, 54-session backfill), with a deterministic SOP + hooks enforcement to be built so drift control is enforced, not model-discretionary. Correction captured to registry.

## Q verdicts (resume reference)

1 counts→settle by suite run+recount · 2 **ship-log REVIVE (Stephen)** · 3 docs follow code (5-tab+Scan) · 4 move 76 unlinked PNGs out of website/static → non-deployed archive · 5 website/static/img/screenshots canonical · 6 website side canonical for memory-svg twins · 7 style-guide stays in Portage for now · 8 rehearsal:3004 ingress delete — **awaiting Stephen go (infra)** · 9 keep sed-rewrite convention, document it · 10 demo identity stays, creds only in Doppler · 11 add session_reports to KB search docs · 12 verify-on-touch · 13 adopt list; Doppler count = 73 now · 14 graphify audit files stay, fold into next pass · 15 @imgly dep removal → small code PR.

## Learnings

- `graphify update .` regenerates graph.html but never wipes graphify-out/ — persistent additions in subdirectories survive; nginx serves `index graph.html` per directory (subpages must be graph.html, not index.html).
- Docusaurus build verifiable without touching the live site: mirror the CI steps (sed rewrites + img copy) into a scratchpad copy of the shared docs-site and build with onBrokenLinks throw.
- Audit-then-edit-then-add as three gated passes with a machine-checkable worklist kept 8 ambiguous edits from being guessed — they came back as tagged skips instead of silent wrong answers.

## Insights

- Skip-with-blocking-question-ID beats best-guess in doc edit passes: every blocked line carries its Q number, so answering the question mechanically unblocks the exact lines.
- Regeneration-safety research before building on generated output is mandatory — a wrong assumption about `graphify update .` would have destroyed the explorer on first update.

## Deferred

- Cleanup pass: execute Q-verdict-unblocked worklist lines (E1/E4/E6/E7/E15/E24/E31/E33/E36 parts, G1/G3/G6/G7), suite run + recount for Q1, session_reports docs fix (Q11)
- Ship-log generator revival + 54-session backfill + SOP/hooks enforcement design (Stephen directs)
- Q8 rehearsal:3004 tunnel ingress removal — needs Stephen go
- :8018 landing page → /explore/ (one-line nginx index change) — needs Stephen go
- @imgly/background-removal dead dep removal (code PR)
- Demo creds still in .claude/skills/frontend-verification/SKILL.md (config scope)
- G9 waits on PR #237 merge; graphify --wiki export would revert wiki/index.md pointer
- Review + commit the 79-file working tree; decide fate of commit aebf33c
- `graphify update .` + registry docs re-ingest after docs land on main
