# Query DHG Registry KB before answering questions about prior work

When the user asks about past decisions, prior ship runs, captured insights, or existing documentation — query the unified KB search endpoint before composing your answer. Trigger phrases include:

- "What did we decide about X?"
- "How was Y built?"
- "Why does Z work this way?"
- "What did we learn from feature W?"
- Any question referencing: past decisions, architecture rationale, prior sessions, or doc pages

```bash
curl -s -X POST http://10.0.0.251:8011/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{"query":"<the question>","project_name":"portage","limit":10}'
```

## Available sources

The endpoint searches all sources by default. Filter with a `"sources"` array when you need a specific corpus:

| Source | Contains |
|--------|---------|
| `docs` | Docusaurus documentation chunks |
| `insights` | AI-captured ★ Insight blocks from Claude sessions |
| `decisions` | Architectural decision logs with alternatives and rationale |
| `ship_sessions` | /ship workflow records: plans, decisions, deferred items |
| `corrections` | User corrections to Claude behavior with category and lesson |
| `bug_fixes` | Root cause analyses: symptom, cause, fix, severity |
| `deferred_items` | Work discovered but intentionally deferred for later |
| `agent_sessions` | Claude Code session summaries and metadata |
| `dev_changelog` | Development changelog entries by epic/category |
| `session_reports` | Narrative end-of-session reports (story + learnings/insights/deferred), from `docs/session-reports/` |

## How to use results

- Synthesize the answer from retrieved content — do not echo the raw response
- Cite specific sources using the format `[decisions/decision-slug]`, `[ship_sessions/feature-slug]`, or `[docs/file-path]`
- If results contradict each other, surface the contradiction and ask the user which takes precedence
- If results are sparse (0–1 hits), say so honestly — do not pad with training-data fabrications

## When NOT to query

- Pure code questions where the answer is readable in a file you already have
- User explicitly says "don't search the registry" or "answer from current code"
- Simple syntax or lookup questions with no project-history dimension
- Current run-time state or live process status (registry data would be stale)

## Rules

- Fire-and-forget — if the registry is unreachable, answer without KB context and note the fallback
- Always use LAN IP `10.0.0.251:8011`
- Default to `"project_name":"portage"` unless the user asks a cross-project question; omit the field to search all projects
- Never block on a registry call — synthesize what you have and move on
