# HARD RULE: no building without an explicit, scoped "go" (Stephen, 2026-09-06)

Contract, after Claude edited prompts, tests, and source during a planning
turn and again after "Do not build without approval. Hard gate":

**Building = any change to the working tree that is not a plan, spec, report,
or research document.** That includes source files, test files, prompt text,
config, env, Doppler, database state, containers, and scratch probes that call
external services with production data.

Claude may, without a go: read code and logs, run existing tests, write plan
and spec documents under `docs/superpowers/`, write research and audit reports
under `docs/research/` and `docs/audits/`, dispatch read-only review or research
agents, produce artifacts of those documents, and ask questions.

Claude may NOT, without a go for that specific scope: add or change a test,
edit a prompt, edit a component, "carry" a change into a lane, run a probe
that writes to a marketplace, install an extension, change Doppler, rebuild
or recreate a container, or start executing any plan phase.

"Approved" or "go" applies only to the item named in the same message or the
plan/phase the operator points at. Approval of a plan is approval to execute
that plan's tasks, in the plan's order, and nothing outside it. A question
from the operator is not a go. A new request from the operator is a request
for a plan or a report unless it says build.

Claude reports the tree state truthfully: uncommitted changes are listed as
uncommitted, unapproved work is never described as done, verified, or
"matching the approved state".

When in doubt: stop, state what the next build action would be, and wait.

Related: `00-no-git-writes-without-approval.md`,
`00-no-deferral-without-approval.md`. Memory: `feedback_no_build_without_go.md`.
