# Review findings: FIXED or APPROVED+FILED+SLOTTED — no third bucket (Stephen, 2026-08-07)

Subordinate to `00-no-deferral-without-approval.md`; closes its euphemism
loophole.

Any work surfaced by a review, audit, verification pass, or conversation that
is NOT fixed in the current session **is a deferral**, regardless of what it
is called. Banned labels that have been used to dodge the rule: "PR defer-list
note", "follow-up candidate", "flagged for later", "your call at PR time",
"noted in PR body".

## Required handling, per finding

1. **Build it now** when no genuine must-defer rationale exists. "Wider blast
   radius", "keeps the PR small", "separate concern" do not qualify (same
   auto-rejected shapes as rule 00).
2. Otherwise **propose it explicitly** in the visible answer: numbered, plain
   English, truthful rationale, recommendation. Wait for Stephen's per-item
   yes/no.
3. On approval: file with `DEFERRAL_APPROVED=1 post-deferred-items.sh` AND
   slot it into the active phased plan/task list with the registry id. Both,
   same session.

## Session-end self-check

Enumerate every finding from every review/audit run this session. Each must
be: FIXED (with proof), or APPROVED + FILED + SLOTTED (citation). Any finding
in neither state = the session is not done.

Origin: 2026-08-07 Phase 1 review — 8 findings presented as "defer-list
notes"; operator: "you are just not classifying them as such to avoid
recording them or doing the work."
