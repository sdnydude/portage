# Capture ship sessions to registry

Post ship sessions in real-time when possible. The Stop hook guarantees nothing is missed.

```bash
~/.claude/scripts/post-ship-session.sh '{"project_name":"portage","feature":"<name>","approach":"<summary>","status":"complete","complexity":"<simple|complex>","tdd":<true|false|null>,"pr_url":"<URL>","branch":"<branch>","completed_at":"<ISO 8601>","commits":["<hash msg>"],"deferred":["<item>"],"decisions":["<item>"],"review":{"agents":[],"critical_found":0,"important_found":0},"verification":{"typecheck":"pass","tests":"<summary>","lint":"clean"},"tags":["<tag>"],"model_name":"claude-opus-4-6"}'
```

**Required fields:** project_name, feature. All others optional.
