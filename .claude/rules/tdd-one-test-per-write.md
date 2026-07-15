# HARD RULE: one tdd-guard test per turn

When tdd-guard is active (it is, on apps/api AND apps/web), every Write/Edit that
adds tests adds EXACTLY ONE test (`it`/`test` block). No batches, ever — not for
"related" tests, not for schema rails, not for "obvious" cases, not in new test
files (a new file starts with one test only).

This is a token-burn rule, not just a process rule: multi-test writes get
rejected by the validator, and the rejected content + retry costs more than the
one-at-a-time rhythm ever does. Stephen has flagged this repeatedly.

The rhythm, per test:
1. Add ONE test (small Edit, not full-file Write)
2. Run it — confirm red (or green for a guard-rail test paired with the code it pins)
3. Minimal implementation
4. Run — green
5. Next test

If the validator hedges on a compliant single-test edit, retry the SAME edit
verbatim once — do not rewrite it larger.

Subagent dispatch: any Agent/Task prompt that involves writing tests in this
repo MUST include this rule verbatim in its instructions.
