# Deferral P2 — capture-pipeline integrity ship

**Span:** 2026-08-21 morning → 2026-08-22 midday · **Repos:** dhg-memreg, dhgaifactory3.5, portage · **PRs:** dhg-memreg#1, dhgaifactory3.5#26, portage#313 (all merged 2026-08-22)

## The story

P2 set out to make session captures land-verified and durable (registry items
`7d218492` critical, `183474c5` high, `166909d3` fold-in). The approved plan
text turned out to understate reality twice over — in both directions.

**Phase 1 flipped the design.** A 4-advisor spec review killed the plan's core
mechanism before a line was written: the proposed parallel
`sha256(project|field|date)` idempotency column would have been a second,
collision-prone identity fighting the natural-key unique constraints and
upserts the registry already enforces on all 8 capture tables (migrations
021/023/024/025/030). Deviation A: natural keys ARE the idempotency identity —
no column, no migration. The same review found the real blocker nobody knew:
`REGISTRY_WRITE_AUTH_MODE` had defaulted to `off` in production — every capture
endpoint was LAN-writable with no credentials, making "idempotent upsert" mean
"anyone can overwrite any row by title." Write-auth enforcement became an
in-scope prerequisite (deviation D).

**The enforce flip bit immediately and instructively.** Five live tests failed
after the flip: dhg-memreg's own ingest scripts, memory tool, and daemon steps
were tokenless writers whose 401s the fire-and-forget contract swallowed
silently (bug_fix 641f56b3). The writer inventory had covered aifactory and
portage callers but missed memreg's own — the exact silent-failure class P2
exists to close closed over itself.

**Build was TDD throughout** (tdd-guard active; cross-repo visibility solved by
symlinking portage's test.json onto the active repo's pytest reporter output).
Live acceptance passed on the real stack: registry stopped → dead-letter +
exit 0; restarted → replay lands within one tick, queue drains, counter
increments; double-fire → one row by direct DB count; all 8 pipelines smoke
post-cleanup.

**Review rounds earned their cost.** The 6-agent diff review caught that my
whole-cycle-lock fix had traded away crash atomicity — an in-place truncate
that a SIGKILL mid-rewrite would turn into a wiped queue. The repair is the
session's best pattern: all writers serialize on a sibling `.lock` file that
`os.replace` never swaps, and the rewrite goes tempfile → fsync → replace under
it (insight af18daff). The operator-requested final advisor round then caught
what the fix batch itself missed: dispatch() classifying 409s and permanent
4xxs as dead-letterable, the Stop path parsing the transcript three times, and
a genuinely critical Mac footgun — a machine with capture hooks, no token, and
no replay daemon loses every capture permanently. One advisor claim was
disproven on verification (the "live 401ing session-capture writer" was the
advisor's own probe hitting an unwired stale copy).

**Everything shipped merged the same day**, with zero deferrals across ~50
findings — each fixed in-scope, rejected with recorded rationale, or
invalidated by direct read.

## Learnings

- flock + os.replace don't compose naively: a lock on the data file is void the
  moment the rewrite swaps the inode — a blocked writer appends into an
  unlinked file. Sibling lockfile that never moves, atomic replace inside it.
- Flipping auth enforcement on a fire-and-forget pipeline hides its own
  breakage: 401s vanish into exit-0. Inventory writers by *reading every
  caller*, then watch the server's DENY log — and remember your own repo's
  scripts are writers too.
- Plan text goes stale against a moving codebase: half of P2's "build X" items
  already existed (DLQ, replay step, transcript detection). Ground-truth
  reading before building saved a parallel rebuild.
- An advisor finding is a claim, not a fact: one HIGH ("live writer 401ing")
  dissolved under direct verification — the wired writer was tokenized; the
  log entry was the advisor's own probe.
- tdd-guard's validator only believes test evidence it can read from its
  configured project root; cross-repo work needs the reporter output bridged
  (symlink) or the guard fights every edit.

## Insights

- Sibling-lockfile + tempfile/os.replace as the only safe DLQ write discipline
  (af18daff).
- tdd-guard cross-repo symlink bridge (a552a200).
- Natural-key upserts double as the idempotency layer — a second key scheme is
  strictly worse (decision d9e0c0ca).

## Deferred

None. P2 closed with zero deferrals; the deferral-audit successor phases
(P3–P8) were already scoped in docs/deferral-plan-2026-08-15.md.

## Operator actions completed in-session

Mac token distributed; LangGraph token item closed as overtaken (Pydantic AI +
Langfuse direction, decision e038a72a); smoke-row DEFERRAL_APPROVED use
acknowledged with Phase-7 approval.
