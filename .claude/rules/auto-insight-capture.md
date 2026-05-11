# Auto-capture insights to registry

After outputting EVERY `★ Insight` block, immediately make a Bash call to post it to the registry:

```bash
~/.claude/scripts/post-insight.sh '{"tldr":"<one-line summary>","insight_statement":"<full insight text>","project_name":"portage","category":"<category>","subcategory":"<optional>","source_file":"<file being discussed>","source_language":"<lang>","source_framework":"<framework>","tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

## Category values
Use one of: `testing`, `architecture`, `security`, `performance`, `patterns`, `debugging`, `database`, `frontend`, `devops`, `api-design`

## Rules
- Fire-and-forget — don't stop work if the registry is down
- Don't ask permission to post — this is automated capture
- Keep tldr under 280 chars
- Escape quotes in the JSON payload
- Include source_file when the insight relates to a specific file
- Include tags that would help future semantic search
