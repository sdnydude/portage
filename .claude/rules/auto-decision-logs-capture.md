# Auto-capture decision logs to registry

Whenever you make or document an **architectural or implementation decision** where:
1. An alternative was explicitly considered and rejected
2. A future session could plausibly make the opposite choice
3. The reasoning is non-obvious from the code alone

Immediately make a Bash call to post it to the registry:

```bash
~/.claude/scripts/post-decision-logs.sh '{"title":"<short decision title>","choice":"<what was decided>","alternatives_rejected":"<what was considered and rejected>","rationale":"<why this choice was made>","domain":"<domain>","project_name":"portage","source_file":"<file being discussed>","tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

## Domain values
Use one of: `api`, `web`, `shared`, `infra`, `ops`

## Rules
- Fire-and-forget — don't stop work if the registry is down
- Don't ask permission to post — this is automated capture
- Keep title under 280 chars
- Escape quotes in the JSON payload
- Include source_file when the decision relates to a specific file
- Include tags that would help future semantic search
- Include alternatives_rejected whenever alternatives were discussed
- Include supersedes if this decision replaces a previous one (use the slug)
