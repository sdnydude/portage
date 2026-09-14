# Git writes are free; deploy is the checkpoint (Stephen, 2026-09-13)

**Operator directives 2026-09-13 ("remove the commit and push gates", then
"remove merge gate"):** `git commit`, `git push`, `gh pr create`, and
`gh pr merge` need no per-action approval and have no mechanical gate. The
`git-gate.sh` prompt (removed 09-08, 74e6f1a), `review-before-commit.sh`, and
`proof-before-push.sh` hook entries are all gone.

**Why merge is safe to free:** every merge is a merge commit (`--no-ff` /
GitHub merge button), so one `git revert -m 1 <merge-sha>` undoes a whole PR;
branches stay on origin. Merging does not deploy anything.

**The checkpoint is deploy.** Before any `docker compose up` that recreates
`portage-api` or `portage-app`:
1. Tag the running images `portage-{api,app}-rollback:<date>` so rollback is
   a retag + recreate, not a rebuild.
2. Push any schema change first (`db:push --verbose`, expect only the intended
   statements); never let an image that expects new columns go live before
   them.
3. Name every service you intend to rebuild with `--build`; record
   `docker inspect --format '{{.Name}} {{.Image}}'` before and after and diff
   it. Never `up -d portage-app` alone.
4. After: health, error count, and the live check on the real app.
Data written to eBay/Reverb or to item rows is not reversible by git; that is
why the care sits at deploy and use, not at merge.

**What did not change:**
- Commit by pathspec, never bare `git commit`; work on a branch, land through
  a PR with CI green.
- Adversarial review before the PR; findings are FIXED or
  APPROVED+FILED+SLOTTED (`01-no-deferral-euphemisms.md`). Review records in
  `.claude/review-records/` remain the audit trail.
- Definition of Done still requires live-observed proof against real data
  before anything is called done, shipped, or verified
  (`feedback_definition_of_done`, `feedback_live_proof_over_tests`). Proof
  screenshots still go to `apps/web/test-results/proof/` and to the operator.
- The no-build-without-go rule (`00-no-build-without-go.md`) still governs what
  gets built; this file only governs how finished work is published.

History: per-action approval for commit/push/merge was imposed 2026-08-03
after unapproved merges under an assumed blanket auto mode. Retired
2026-09-13: the asks and proof hook consumed more operator time than they
protected, while the real incident of the week (a 38h publish outage) came
from a deploy, not a merge.
