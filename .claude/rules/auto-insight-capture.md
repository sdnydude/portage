# Auto-capture insights to registry

## When to trigger

**Every time** you write a `★ Insight` block in conversation text, you MUST immediately follow it with a `post-insight.sh` call. The insight block and the registry post are a single atomic action — never write one without the other.

Also trigger when you discover something non-obvious about the codebase, even if you don't write an explicit `★ Insight` block:

1. A **pattern** worth reusing (architecture, data flow, error handling approach)
2. A **surprising discovery** (code that doesn't work the way it appears, hidden constraints)
3. A **root cause** that reveals a systemic issue (not just the immediate fix)
4. A **technique** that solved a hard problem (workaround, tool usage, debugging approach)
5. A **design tradeoff** that was evaluated but doesn't rise to a full decision log

## When NOT to trigger

- General programming knowledge (how React hooks work, what SOLID means)
- Restating what CLAUDE.md or docs already say
- Trivial observations ("this file exports 3 functions")
- Duplicate of an insight already posted this session

## What to capture

```bash
~/.claude/scripts/post-insight.sh '{"tldr":"<280 char summary>","insight_statement":"<full text>","project_name":"portage","category":"<category>","source_file":"<file>","tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

### Field guide

| Field | Description |
|-------|-------------|
| `tldr` | One-line summary (max 280 chars). This is what shows in search results — make it specific and scannable |
| `insight_statement` | Full explanation. Include the WHY, not just the WHAT. A future session should be able to act on this without re-deriving it |
| `category` | One of the valid categories below |
| `source_file` | Primary file the insight relates to (if applicable) |
| `tags` | Semantic search terms — feature area, tech, pattern name |

### Categories

| Category | When to use |
|----------|-------------|
| `testing` | Test strategy, TDD patterns, coverage approaches |
| `architecture` | System design, service boundaries, data flow |
| `security` | Auth, encryption, XSS/injection, token handling |
| `performance` | Latency, optimization, caching, scaling |
| `patterns` | Reusable code patterns, design patterns in use |
| `debugging` | Diagnostic techniques, tool usage, root cause analysis |
| `database` | Schema design, query patterns, migration strategy |
| `frontend` | React patterns, state management, UI/UX approaches |
| `devops` | CI/CD, Docker, deployment, infrastructure |
| `api-design` | Endpoint design, validation, error handling |

## Do not ask permission

Call this automatically every time the trigger condition is met. Do not announce it. Do not ask "should I capture this?" — just do it. The script exits 0 on failure, so it never blocks the session.

## Critical rule

Writing a `★ Insight` block without posting to the registry is a **bug**. The insight exists only in the ephemeral conversation — it will be lost on session end. The registry post is what makes it durable and searchable.
