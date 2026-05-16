# Capture insights to registry

Post insights in real-time when possible. The Stop hook guarantees nothing is missed.

```bash
~/.claude/scripts/post-insight.sh '{"tldr":"<280 char summary>","insight_statement":"<full text>","project_name":"portage","category":"<category>","source_file":"<file>","tags":["<tag>"],"model_name":"claude-opus-4-6"}'
```

**Categories:** testing, architecture, security, performance, patterns, debugging, database, frontend, devops, api-design
