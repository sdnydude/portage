# Auto-capture ship sessions to registry

When a `/ship` workflow reaches **Phase 7 (Deploy + Verify)** or the ship-state status changes to `complete`, immediately post the session to the registry:

```bash
~/.claude/scripts/post-ship-session.sh '{"project_name":"<project>","feature":"<feature name>","approach":"<approach summary>","status":"<complete|abandoned>","complexity":"<simple|complex>","tdd":<true|false|null>,"pr_url":"<PR URL or null>","branch":"<branch>","completed_at":"<ISO 8601 timestamp or null>","commits":["<hash msg>","<hash msg>"],"deferred":["<item>"],"surprises":["<item>"],"decisions":["<item>"],"review":{"agents":["<agent>"],"critical_found":<n>,"important_found":<n>},"verification":{"typecheck":"<pass|fail>","tests":"<summary>","lint":"<summary>"},"file_map":{"modify":["<file>"],"create":["<file>"]},"tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

## Rules
- Fire-and-forget — don't stop work if the registry is down
- Don't ask permission to post — this is automated capture
- Post once per /ship completion, not on every phase transition
- Include all structured data from the ship-state file
- Escape quotes in the JSON payload
- Include tags that would help future semantic search (feature area, tech used)
- For `commits`, include the short hash + first line of commit message
- For `deferred`, include the full deferred item text
- For `review`, include agent names and issue counts
- For `verification`, include pass/fail status for each check
- Set `completed_at` to ISO 8601 timestamp when status is "complete"
