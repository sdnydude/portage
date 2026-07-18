# Auto-capture session reports to registry

At session end, write a narrative session report to the repo AND post it to the DHG Registry. The markdown file is the source of record; the registry row is the canonical ingest source for search and the future llmwiki install. The two are a single atomic action — never do one without the other.

## When to trigger

- The user says "done", "stop", "bye", or otherwise signals the session is wrapping up
- The user explicitly requests a session wrap, session report, or end-of-session summary
- A long working session concludes a coherent arc of work (e.g., a batch of PRs merged)

Do NOT fire for trivial sessions (a quick lookup, a one-line fix with no story to tell) or more than once per session unless the report is being revised — reposting the same title upserts, it does not duplicate.

## Step 1 — Write the report file

Path: `docs/session-reports/YYYY-MM-DD-<slug>.md` (date = session end date, ET; slug = short kebab-case description of the session's arc).

Content: the **story** of the session's work in narrative markdown — what was attempted, what happened, what shipped — plus dedicated sections for **Learnings**, **Insights**, and **Deferred** items. Include PR numbers, key files, and root causes where they matter. Write for a future reader who was not in the session.

## Step 2 — Post to the registry

Call the capture script silently in a bash tool call. Because `report_md` carries the full file body, prefer `--stdin` (heredoc-safe — apostrophes and metacharacters in the report are inert):

```bash
~/.claude/scripts/post-session-reports.sh --stdin << 'EOF'
{"title":"<short report title>","session_span":"<e.g. 2026-07-09 evening → 2026-07-10 evening>","project_name":"portage","prs":["#189","#190"],"report_md":"<full markdown body of the report file>","learnings":["<learning>"],"insights":["<insight>"],"deferred":["<deferred item>"],"category":"<category>","source_file":"docs/session-reports/YYYY-MM-DD-<slug>.md","tags":["<tag1>","<tag2>"],"model_name":"<actual model in use>"}
EOF
```

Build the JSON programmatically (e.g., `python3 -c` or `jq`) when the report body contains characters that would break hand-rolled JSON — the body must be a properly escaped JSON string.

### Field guide

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Short report title (max 280 chars). This is the upsert key with `project_name` — keep it stable when revising a report |
| `report_md` | yes | Full narrative markdown body — the entire report file content |
| `project_name` | yes | "portage" (or current project slug) |
| `session_span` | no | Human-readable span, e.g. "2026-07-09 evening → 2026-07-10 evening" |
| `prs` | no | Array of PR numbers/URLs shipped in the session, e.g. `["#189","#193"]` |
| `learnings` | no | Array of learning strings extracted from the report's Learnings section |
| `insights` | no | Array of insight strings from the report's Insights section |
| `deferred` | no | Array of deferred-item strings from the report's Deferred section |
| `category` | no | One of the valid categories below |
| `source_file` | no | Repo-relative path of the report file, e.g. `docs/session-reports/2026-07-10-scan-outage-and-beta-bug-batch.md` |
| `tags` | no | Semantic search terms — feature areas, tech, incident names |
| `session_id` | no | Current session ID if known |
| `model_name` | no | Actual model in use, e.g. "claude-opus-4-6" |

### Category values

Use one of: `feature`, `bugfix`, `mixed`, `infra`, `docs`, `release`, `investigation`, `other`

| Category | When to use |
|----------|-------------|
| `feature` | Session predominantly shipped new functionality |
| `bugfix` | Session predominantly fixed bugs |
| `mixed` | Meaningful blend of features, fixes, and other work |
| `infra` | Docker, CI/CD, tooling, registry, environment work |
| `docs` | Documentation-focused session |
| `release` | Release prep, deploys, cutovers |
| `investigation` | Diagnosis/exploration session with few or no code changes |
| `other` | Does not fit any category above |

## Rules

- Fire-and-forget — the script always exits 0; if the registry is down the payload is dead-lettered for daemon retry. Never block the session on it
- Don't ask permission to post — this is automated capture. Do not announce it
- Search covers title + report_md + learnings + insights — make those sections substantive
- Keep title under 280 chars; reposting the same (project_name, title) upserts the existing row
- Extract `learnings` / `insights` / `deferred` arrays from the report's own sections — don't invent items that aren't in the file
- Include tags that would help future semantic search (e.g., `["scan","outage","beta"]`)
