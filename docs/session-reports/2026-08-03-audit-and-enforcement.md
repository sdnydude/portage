# Session Report — 23004 Hotfix, Adversarial Audit, Enforcement Hard-Stops

**Span:** 2026-08-03 midday → afternoon (continuation of the sync-refactor session)
**Category:** mixed
**PRs:** #285 (merged); audit fix batch specced, not started

## The story

Stephen reported price edits on an eBay listing failing with "Saved locally but failed to sync to marketplace." The day-old sync log paid for itself immediately: the exact eBay error (23004, Invalid AutoAccept price) was sitting in `marketplace_sync_log`. Root cause: the listing's stored Best-Offer auto-accept ($25) equaled the new price, and the adapter's downgrade retry only *omitted* the threshold tags — but Trading Revise omission keeps values stored on the live listing, so the retry failed identically. Fix (#285): `DeletedField` support in the Trading builders + the retry deletes both thresholds. Merged, live API rebuilt; the listing synced green at 13:23 ET (though without exercising the new path — the conflict had cleared, so live verification of DeletedField is still owed).

An adversarial audit of the session's merged code followed — first a single-agent pass (1 critical, 4 major, 5 minor: badge blind to listings.ts inline syncs; enqueue race; poll-loop kill; ungated retry; worker tick overlap; plus minors), then, when Stephen rejected that as insufficient and its result rendered as "No result — task ended" in his transcript, a three-reviewer re-audit (correctness/concurrency, security/data-integrity, adapter contract). The re-audit added 2 criticals and 5 majors — most damning, two flaws in the fresh #285 fix itself: the update-path retry keeps `BestOfferEnabled` (a category-level rejection freezes all future syncs for the listing after 5 attempts) and its gate misses floor-only configs; also newest-job-wins badge masking permanently failed photo syncs, no `job.userId` re-verification at the worker's token boundary, no rate limit on retry, and swallowed enrichment failures. Total 20 findings, all in the audit artifact and docs/TODO.md, tasked as #5–#24. Nothing built yet — build starts on operator go.

The "No result — task ended" dispute produced a forensic trail: the agent's full report exists in its transcript JSONL (sha256-verified, raw file + parsed markdown delivered), and the debug log shows the completion arriving via the harness's `[Stall] agent_completion` recovery path amid hourly `SSETransport` stream errors. No precedent claim — first observed occurrence.

The session's hardest turn: Stephen ruled that unapproved deferrals had broken his eBay account for 18 hours and ordered mechanical enforcement. Two standing rules now have hooks: `deferral-gate.sh` (every deferred-item capture prompts for approval; deferral proposals require technical must-defer rationale — convenience rationales auto-rejected) and `git-gate.sh` (every commit/push/PR-create/PR-merge prompts individually; "auto mode" covers building only). Both registered in project settings.json, with rule files injected each session. Also ruled: raw transcripts are never curated by Claude or agents — deliver the file.

## Learnings

- Trading API Revise semantics: omitted fields keep on-listing values; clearing requires explicit DeletedField entries. Same class as the photos omission rule.
- A durable sync log converts a vague "sync failed" report into a 2-minute root cause — first real payoff of the P1 work, same day it shipped.
- Multi-reviewer adversarial batches find flaws single-pass audits miss — including in fixes shipped hours earlier by the same author.
- The task-notification transcript is recoverable evidence: subagents' full JSONL lives under ~/.claude/projects/.../subagents/ even when the UI renders an empty turn.

## Insights

- Harness stall-recovery (`[Stall] agent_completion`) + flaky SSE stream = agent output that reaches the orchestrator but renders as "No result — task ended" in the transcript UI. Evidence bundle: debug log line ~26135 + hourly SSETransport errors + intact subagent JSONL.
- Enforcement asymmetry lesson: rules that exist only as prose (CLAUDE.md line, memory file) get violated under momentum; rules wired as PreToolUse ask-prompts cannot be skipped silently. Behavioral rules that matter need a mechanical twin.

## Deferred

*(none — deferrals now require per-item operator approval; the 20 audit findings are scheduled work (tasks #5–#24), and the 2 Reverb-doc gaps await an explicit operator decision, recorded in whats-next.md Blockers)*
