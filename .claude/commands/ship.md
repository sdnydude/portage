# /ship — Full Feature Shipping Workflow (with Dev Tools)

You are running a 7-phase workflow to take a feature from idea to merged PR. This is the DHG AI Factory's production shipping process. Every phase builds on the previous one and carries context forward — do NOT re-explore or re-ask what was already established.

**v3 additions:** tdd-guard (TDD enforcement hooks), AgentShield (security audit), claudekit (project health), ccpm (spec-driven PM) are integrated into the workflow.

The user may have provided a feature description: $ARGUMENTS

If no arguments were provided, ask: **"What are we shipping?"** and wait.

---

## Resume Check

Before starting Phase 1, check if `.claude/ship-state.md` exists and contains `status: in_progress` or `status: stopped`. If it does, read the file and ask:

**"A previous /ship run was in progress at Phase [N]: [feature description]. Resume or start fresh?"**

If resuming, load the state (approach, file map, plan, progress) and continue from the recorded phase. If starting fresh, version the old state file as `ship-state_v{N}.md` and begin Phase 1.

---

## Rules (non-negotiable)

These come from CLAUDE.md and .claude/rules/. The /ship workflow enforces them structurally:

- **Overhead IS the quality.** Standards, processes, rigor, and thorough planning are the product clients pay for. Never optimize for speed or convenience; always optimize for best outcome. Quality and accuracy are first priority. Fortune 500 execution.
- **PLANNING AND BUILDING ARE SEPARATE PHASES.** Do not write files, run commands, or generate code until the design/plan is fully worked through AND Stephen explicitly approves moving to implementation. Jumping to code before planning is complete produces half-finished work, abandoned sessions, and unnecessary refactors. When in doubt, keep planning. Phases 1-3 are PLANNING. Phase 4 is BUILDING. Never cross that boundary without explicit approval.
- **No placeholders, TODOs, or provisional logic.** Every file works on first deploy.
- **View files before editing.** Always.
- **Run verification after any change.** Show proof.
- **One fix per hypothesis.** If it fails, form a new hypothesis.
- **No silent refactors.** Every change has operational rationale.
- **No completion claims without fresh verification evidence.** Red flags: "should", "probably", "seems to".
- **Never commit secrets.** No .env values, no API keys, no passwords in any file.
- **Version planning files before overwriting.**
- **tdd-guard is active.** The tdd-guard plugin enforces test-first development via PreToolUse hooks. When TDD is enabled (Phase 3 decision), write tests before implementation — tdd-guard will block code edits that lack corresponding tests.

---

## Phase 1: Brainstorm

**Goal:** Understand the problem, explore approaches, choose a direction, and produce a spec.

1. Read CLAUDE.md to load full project context (architecture, known issues, tech stack).

2. **Feasibility check.** Before any design work, verify the feature doesn't conflict with existing architecture. Check:
   - Port conflicts with existing services (see CLAUDE.md port table)
   - Docker network/container conflicts
   - Database schema impacts
   - Marketplace API limitations

3. **Divergent thinking.** Before converging on approaches, explicitly explore non-obvious alternatives. Ask: "What if we did this completely differently?" Consider unconventional patterns, existing tools that might already solve this, or simpler reframings of the problem. Then converge.

4. **Ask clarifying questions.** One at a time. Multiple choice where possible. Do not ask more than 3 questions total — use judgment for the rest.

5. **Propose 2-3 approaches** with tradeoffs. Include:
   - What each approach changes
   - Risk level (low / medium / high)
   - Which known issues it interacts with
   - Your recommendation and why

6. Get user approval on the approach. If the user says "you decide" or "whatever you think", state your recommendation explicitly and confirm: "Going with [approach]. Correct?"

7. **Complexity check.** Flag the feature as **complex** if any of these are true:
   - Crosses 3+ services
   - Touches database schema
   - Will likely produce >5 tasks
   If complex, the spec (step 8) must be detailed. If simple, a light spec is sufficient.

8. **Write a spec.**
   - **Light spec (simple features):** 3-5 bullet points covering what it does, acceptance criteria, and edge cases.
   - **Detailed spec (complex features):** What it does, what it doesn't do, acceptance criteria, edge cases, affected services, data flow, error scenarios.

9. **Spec review.** Iterate on the spec with Stephen. Up to 5 iterations until the spec accurately reflects intent. Do not rush past this — the spec is the contract for everything that follows.

**Output:** Chosen approach + approved spec.

Write initial `.claude/ship-state.md`:
```
status: in_progress
phase: 1
feature: [description]
approach: [chosen approach]
complexity: [simple/complex]
spec: [approved spec content]
```

> **Phase 1 complete. Continue to Phase 2 (Explore)?**

---

## Phase 2: Explore

**Goal:** Map the relevant codebase once. Every later phase uses these findings — no re-exploration.

1. Launch 2-3 explorer agents in parallel using the Agent tool (subagent_type: Explore). Each agent targets a different area:
   - Agent 1: The files that will be modified (read them, understand current state)
   - Agent 2: Related patterns and utilities that can be reused
   - Agent 3: Tests, configs, and dependencies that will be affected

2. When agents return, synthesize into a **file map**:
   ```
   Files to modify:
     - path/to/file.ts (what it does, what changes)
   Files to reuse:
     - path/to/util.ts (function X does what we need)
   Files affected:
     - docker-compose.override.yml (needs new env var)
     - tests/test_x.ts (needs new test case)
   ```

3. Flag anything surprising: "Expected X but found Y. This changes the approach because..."

**Output:** File map + pattern inventory + surprises.

Update `.claude/ship-state.md`: add file map, patterns found, surprises.

> **Phase 2 complete. Continue to Phase 3 (Plan)?**

---

## Phase 3: Plan

**Goal:** Break the work into bite-sized tasks with exact file paths, code, risk flags, and verification steps.

1. **Architecture step (complex features only).** If Phase 1 flagged the feature as complex, start with a component/data flow design before breaking into tasks. Which services talk to which? What's the request path? What data crosses boundaries? Present this for approval before proceeding to the task list.

2. Write the plan as a numbered task list. Each task should take 2-5 minutes. Each task includes:
   - **Files:** Exact paths to read/modify/create
   - **Do:** What to implement — include function signatures, SQL queries, and any logic where multiple valid implementations exist. If the builder would have to make a design decision during implementation, the code goes in the plan.
   - **Verify:** How to prove it works (command to run, output to expect)
   - **Risk:** low / medium / high + blast radius (local / service / cross-service)
   - **Rollback:** For tasks that touch shared state (DB, config, Docker), include the rollback command

   Example:
   ```
   Task 3: Add GET /messages/unread-count endpoint
     Files: apps/api/src/routes/messages.ts
     Do: Add endpoint that counts inbound messages with null readAt
     Test: apps/api/src/routes/messages.test.ts — "returns unread count"
     Verify: npm run test:api -- --grep "unread count"
     Risk: low (local — new read-only endpoint)
     Rollback: git revert <commit>
   ```

3. **Deploy order (multi-service only).** If tasks span multiple services, specify the rebuild/restart order and why.

4. **Order tasks by dependency.** Independent tasks can be marked as parallelizable.

5. **Identify tasks that touch shared state** (database schemas, Docker configs, shared libraries). These get "medium" or "high" risk automatically.

6. Apply DRY, YAGNI. If something already exists in the codebase (found in Phase 2), reuse it. Do not build what you found.

7. **Chunk review (>5 tasks).** If the plan has more than 5 tasks, present them in groups of 3 for review. Get approval per chunk before showing the next.

8. **TDD decision.** Ask: "Do you want TDD for this feature?" If yes, Phase 4 writes tests before implementation for each task. Note: **tdd-guard hooks are active** and will enforce test-first ordering when TDD is enabled.

**HARD GATE:** Present the plan (or final chunk) and wait for user approval. Do not proceed to Phase 4 without explicit "go", "approved", "build it", or similar.

**Output:** Approved task list.

Update `.claude/ship-state.md`: add full plan, TDD decision, deploy order.

> **Phase 3 approved. Continue to Phase 4 (Build)?**

---

## Phase 4: Build

**Goal:** Execute the plan. Follow it exactly. Commit after each task.

1. **Branch check.** Run `git branch --show-current`. If on `main`, stop and ask: "You're on main. Create a feature branch, or proceed on main?" Do not proceed without explicit answer.

2. **Pre-build health check.** Run `claudekit doctor` to validate project hook/command configuration before building. Fix any issues flagged.

3. **Create TodoWrite tasks** for each plan item. This provides persistent in-session state that survives context compression.

4. For each task in the plan:
   a. Announce: **"Task N/total: [description]"**
   b. Read the files listed in the task (view before edit — always)
   c. If TDD is enabled: write the test first, run it (expect failure), then implement. tdd-guard enforces this ordering via PreToolUse hooks.
   d. Implement exactly what the plan says
   e. Run the verification command from the plan
   f. If verification passes, commit with a descriptive message
   g. If verification fails, diagnose (one fix per hypothesis), fix, re-verify
   h. **Debugging escalation:** If verification fails twice (two hypotheses tested and failed), stop. State the problem clearly, form ranked hypotheses, and present them to Stephen before attempting a third fix. Invoke the systematic-debugging protocol.
   i. If tests exist for the affected code, run them. Report result.
   j. Update TodoWrite task status and `.claude/ship-state.md` with progress.

5. **Scope creep guard.** When discovering an unrelated issue during build:
   - **Unrelated issues:** Log to the **defer list** in `.claude/ship-state.md`. Do NOT fix. Do NOT stop to ask. Log it and keep building.
   - **Related blockers:** Stop and ask Stephen. This is not scope creep — it's a blocker.

6. **Parallel execution.** If the plan marked tasks as parallelizable, dispatch them as parallel agents using the Agent tool. Each agent gets: the task description, file paths, verification command, and the instruction "commit when done."

7. **Subagent reconciliation.** After parallel agents return, diff their changes against each other. Look for logical conflicts: duplicate functions, inconsistent naming, overlapping concerns — not just merge conflicts. If conflicts exist, resolve them before proceeding.

8. **Stop when blocked.** If something unexpected happens, do not guess or force through. State what's wrong and ask the user.

9. After all tasks complete, show a summary:
   ```
   Built: N/N tasks complete
   Commits: [list of commit messages]
   Tests: X passed, Y failed, Z skipped
   Deferred: [count of items in defer list]
   ```

**Output:** All tasks implemented, verified, and committed.

Update `.claude/ship-state.md`: mark all tasks complete, list commits.

> **Phase 4 complete. Continue to Phase 5 (Verify)?**

---

## Phase 5: Verify

**Goal:** Prove everything works. No claims without evidence.

This phase exists because "it should work" is not verification. Run every check fresh.

1. **Run the full test suite:**
   ```bash
   npm run test:api
   ```
   Show the full output. Do not summarize. If tests fail, fix them before proceeding.

2. **Type check all workspaces:**
   ```bash
   npm run typecheck
   ```

3. **Lint check:**
   ```bash
   npm run lint
   ```

4. **Verify each task's verification command** from the plan. Run them all again, fresh. Show output.

5. **Health check affected services:**
   - `docker compose ps` — all relevant containers healthy?
   - `curl` health endpoints — responding?
   - Any database changes applied correctly?

6. **AgentShield security scan.** Run the security audit on the project config:
   ```bash
   npx ecc-agentshield scan
   ```
   Review findings. If any new Critical or High findings were **introduced by this feature** (compare against the baseline of 40 existing findings), fix them before proceeding. Pre-existing findings are acceptable.

7. **Regression check.** Did existing functionality break? Spot-check endpoints/features that existed before this work.

8. **Performance baseline.** For each new endpoint, capture response time:
   ```bash
   curl -s -o /dev/null -w "%{time_total}" http://10.0.0.251:8016/<endpoint>
   ```

9. **Meta-verify ship-state.md.** Quick check: does the state file accurately reflect current reality?

10. **State the verdict with evidence:**
    - "All N verification commands pass. Output: [shown above]"
    - "Tests: X/Y pass."
    - "Typecheck: pass/fail."
    - "Lint: clean/N errors."
    - "AgentShield: no new findings / N new findings [details]."
    - "Services: all healthy."
    - "Performance baselines: [endpoint: Xms]"

    If anything fails, go back to Phase 4 for that specific task.

**Output:** Verification evidence showing everything works.

Update `.claude/ship-state.md`: add all verification results.

> **Phase 5 complete. All checks pass. Continue to Phase 6 (Review)?**

---

## Phase 6: Review

**Goal:** Catch issues before shipping. Fix them, don't just report them.

1. **Dispatch 6 specialized review agents in parallel** using the Agent tool. Each agent reviews the full diff (`git diff` against the base branch):

   | Agent | Focus |
   |-------|-------|
   | silent-failure-hunter | Swallowed errors, empty catches, bad fallbacks, `return None` in error paths |
   | type-design-analyzer | Weak types, missing invariants, poor encapsulation |
   | code-reviewer | Style violations, convention mismatches, best practice gaps |
   | comment-analyzer | Stale comments, inaccurate docstrings, comment rot |
   | pr-test-analyzer | Test coverage gaps, missing edge cases, untested paths |
   | code-simplifier | Unnecessary complexity, duplication, readability issues |

2. **Grep-based silent-failure scan** (runs in parallel with agents). Fast first pass:
   - `catch` blocks with no re-throw or error handling
   - `return null` or `return undefined` after error conditions
   - `// TODO` or `// FIXME` in new code

3. **Unify agent findings.** When agents return, synthesize into a single prioritized recommendation. If agents conflict, resolve the conflict and present the unified recommendation with reasoning. Stephen gets a clean view, not 6 competing reports.

4. **Test coverage check.** For each new function added, verify a test exists. If not, flag as Important severity: "Function X is untested."

5. **Portage-specific checks:**
   - Docker: Does this need a new container? Port conflict with the port table in CLAUDE.md?
   - Database: Schema push needed? Backward compatible?
   - CLAUDE.md compliance: Does the change align with documented architecture?
   - Design system: If UI work, does it use semantic tokens from the design system?

6. **CLAUDE.md update check.** If new ports, services, endpoints, or architecture changes were made, draft the CLAUDE.md update. Do not apply yet — present for approval in Phase 7.

7. **Observability check.** If new endpoints were added:
   - Do they have Prometheus counters/histograms? If not, flag as Important.
   - Are they covered in admin panel? If not, note it.

8. **Severity classification:**
   - **Critical** — blocks shipping (security vulnerability, data loss risk, broken functionality)
   - **Important** — should fix before merge (code quality, missing validation, untested functions)
   - **Minor** — note for later (style nit, optimization opportunity)

9. **Fix-and-re-verify loop.** For each Critical and Important issue:
   a. State the issue and the fix
   b. Apply the fix
   c. Re-run the relevant verification from Phase 5
   d. Confirm it passes

**HARD GATE:** All Critical issues must be resolved. Important issues should be resolved. Only proceed with unresolved Important issues if the user explicitly approves.

**Output:** Review complete, all issues resolved (or user-approved exceptions).

Update `.claude/ship-state.md`: add review findings, resolutions, and any approved exceptions.

> **Phase 6 complete. Ready to ship. Continue to Phase 7?**

---

## Phase 7: Ship

**Goal:** Get it merged. Document what was done.

1. **Stage and commit** any remaining changes from Phase 6 fixes.

2. **Apply CLAUDE.md update** (if drafted in Phase 6 and approved). Include in the final commit.

3. **Push and create PR:**
   - If not already pushed, push the branch with `-u`
   - Create PR using `gh pr create` with this structure:
     ```
     Title: [concise description, under 70 chars]

     ## Summary
     [2-3 bullet points of what was built]

     ## Phases completed
     - Brainstorm: [approach chosen]
     - Spec: [light/detailed, N iterations]
     - Plan: [N tasks, TDD: yes/no]
     - Build: [N commits]
     - Verify: [all checks pass, AgentShield baseline]
     - Review: [N issues found and fixed, agents used]

     ## Test plan
     - [ ] [verification steps someone else can follow]

     ## Dev tool results
     - tdd-guard: [active/inactive, enforcement events]
     - AgentShield: [grade, new findings vs baseline]
     - claudekit doctor: [pass/issues]

     ## Risk
     [blast radius: local/service/cross-service]
     [rollback plan if issues detected]

     ## Deferred items
     [Items discovered during build but intentionally not fixed]
     - [what] in [where] — [why it matters] — [suggested priority]
     ```

4. **Present defer list.** Show the full defer list from Phase 4. Everything discovered but intentionally not fixed, formatted as actionable items.

5. **Registry capture.** Post the ship session to the registry:
   ```bash
   ~/.claude/scripts/post-ship-session.sh '<JSON payload>'
   ```

6. **Ship-log entry.** Generate a Docusaurus ship-log page at `website/docs/ship-log/NNN-<slug>.md` with frontmatter matching existing entries.

7. **Finalize `.claude/ship-state.md`:**
   ```
   status: complete
   pr: [PR URL]
   completed_at: [timestamp]
   ```
   Do not delete the file — it serves as a record of the last ship run.

8. **Present the PR URL** to the user.

> **Shipped. PR: [URL]**

---

## Navigation Commands

The user can say these at any time:
- **"skip"** — jump to the next phase
- **"skip to N"** — jump directly to phase N
- **"stop"** — update `.claude/ship-state.md` with `status: stopped` and current phase, then exit the workflow
- **"back"** — return to the previous phase
- **"status"** — show which phase we're in and what's done

---

## Dev Tools Reference

| Tool | Integrated At | What It Does |
|------|--------------|--------------|
| **tdd-guard** | Phase 3 (TDD decision), Phase 4 (build enforcement) | PreToolUse hooks block code edits without corresponding tests when TDD is enabled |
| **AgentShield** | Phase 5 (verify) | Security audit of `.claude/` config — catches permission gaps, secret exposure, hook issues |
| **claudekit** | Phase 4 (pre-build health check) | Validates project hook/command configuration |
| **ccpm** | On-demand | Spec-driven PM skill — PRDs, epics, GitHub issue sync. Invoke with `/ccpm` if the feature warrants formal PM tracking |

---

## Version History
- **v1** (2026-03-13): Initial 7-phase workflow.
- **v2** (2026-03-13): Full capability restoration + 14 additions. Restored: spec iterations, divergent thinking, 6 review agents, code in plans, chunk review, TodoWrite, subagent reconciliation. Added: resume detection, state persistence, scope creep guard, rollback fields, debugging escalation, complexity-conditional spec, architecture step, TDD toggle, CLAUDE.md update check, observability check, deploy order, post-merge monitoring, performance baselines, actionable monitor section.
- **v3** (2026-05-24): Dev tools integration. Added: tdd-guard enforcement (Phase 3-4), AgentShield security scan (Phase 5), claudekit doctor pre-build check (Phase 4), ccpm on-demand reference. Removed: stale LangGraph/Infisical references. Updated: Portage-specific checks replace generic DHG checks. Added: registry capture and ship-log generation to Phase 7. Added: dev tool results section in PR template.
