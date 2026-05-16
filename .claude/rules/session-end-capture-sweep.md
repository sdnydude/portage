# Session-end capture sweep

Before ending a session or when the user says "done", "that's it", "wrap up", or similar — run a capture audit to ensure nothing was missed.

## Checklist

1. **Insights:** Were any `★ Insight` blocks output this session? For each one, verify a `post-insight.sh` call followed it. If not, post now.

2. **Decisions:** Were any alternatives explicitly considered and rejected? For each, verify a `post-decision-logs.sh` call was made. If not, post now.

3. **Ship sessions:** Did a /ship workflow complete (Phase 7 or status: complete)? Verify `post-ship-session.sh` was called. If not, post now. Also check: if work from a *prior* session was merged/completed in *this* session, capture it.

4. **Corrections:** Did the user correct Claude's behavior? Verify `post-correction.sh` was called. If not, post now.

5. **Bug fixes:** Was a non-trivial bug diagnosed and fixed this session? Verify `post-bug-fixes.sh` was called. If not, post now.

6. **Deferred items:** Was any work discovered but intentionally not done? Verify `post-deferred-items.sh` was called for each. If not, post now. Check ship-state deferred arrays and any "we'll do that later" items.

7. **Memory files:** Were project milestones reached (PRs merged, features shipped, test counts changed)? Update relevant memory files and MEMORY.md index.

## When to run

- User signals session end
- Before the final response in a session
- After completing a /ship Phase 7
- When context is about to be compressed (if detectable)

## How to report

After the sweep, output a brief summary:

```
Capture audit: 2 insights, 1 ship session, 3 decisions posted. Memory updated.
```

Or if nothing was missed:

```
Capture audit: all items already posted.
```

## Do NOT skip this

Even if the session was short. Even if you think everything was captured. Run the checklist. The cost of a 10-second audit is zero compared to lost institutional knowledge.
