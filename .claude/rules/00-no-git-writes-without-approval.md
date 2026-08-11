# HARD RULE: no git state changes without per-action approval (Stephen, 2026-08-03)

`git commit`, `git push`, and `gh pr merge` each require Stephen's explicit
approval for that specific action, every time. "Auto mode", "don't stop
working", or approval of a plan authorizes BUILDING (edits, tests, local runs,
read-only ops) — never publication of code.

**Exempt: `gh pr create`** (operator 2026-08-05, restated 2026-08-10 — "you
can create pr on auto without approval"). The pr-create ask was removed from
`git-gate.sh` on 2026-08-05; opening a PR on an already-approved-and-pushed
branch needs no separate ask. Merge remains gated.

**Proof waivers are Stephen's alone (added 2026-08-03 PM).** Claude never sets
`PROOF_WAIVED=` on its own judgment. When proof-before-push fires: produce the
proof screenshots, or present the waiver request with rationale and wait for
an explicit yes. `git-gate.sh` raises a dedicated prompt on any command
containing `PROOF_WAIVED=`.

Mechanical enforcement: `git-gate.sh` (PreToolUse, Bash) raises a confirmation
prompt on commit/push/merge and on any `PROOF_WAIVED=` usage. Claude must
additionally ask in conversation before reaching the prompt — the hook is
the backstop, not the protocol.

Violation history: multiple unapproved merges/pushes 2026-08-01 → 2026-08-03
(PRs auto-merged under an assumed blanket auto mode). This rule supersedes any
reading of "auto" that includes git writes.
