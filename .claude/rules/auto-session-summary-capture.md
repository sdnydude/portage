# Write session summaries to .remember/now.md

## When to trigger

1. **At the START of meaningful work** — after reading ship-state or understanding the task, write a one-line TLDR of what this session is about
2. **After each significant milestone** — commit, phase completion, major fix, direction change
3. **Before session end** — when the user says "stop", "done", "bye", or when you detect the session is wrapping up

## What to write

Append to `.remember/now.md` using this format:

```
## HH:MM | branch-name | optional-commit-hash
Compressed summary: what was done, key decisions, current state. Max 2-3 lines.
```

Example:
```
## 14:32 | feat/ebay-listing-hardening | 79213c7
fix(listing-flow): self-healing publish() for photo-first eBay path; insight capture rule updated; session-capture Stop hook race fixed (memory-sync empties now.md before session-capture reads it → read daily file instead).
```

## Compression rules

- Maximum compression while preserving all facts, references, verbs, relationships
- Drop articles, prepositions, filler words where context allows
- Parentheses for context, semicolons for fact separation
- Include commit hashes when available
- Include file paths only when they're the key finding

## Why this matters

The Stop hook `session-capture.sh` reads `.remember/now.md` (via the daily file after memory-sync appends it) and posts it to the DHG Registry as the session summary. Without entries in now.md, the registry gets empty session records. This is the only mechanism that preserves session context across conversations.

## Do not ask permission

Write to `.remember/now.md` automatically at each trigger point. Do not announce it. Do not ask "should I update the journal?" The write is the journal — it's infrastructure, not a deliverable.
