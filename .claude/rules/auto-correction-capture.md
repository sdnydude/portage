# Auto-capture correction events to registry

When the user pushes back on Claude's response with a correction, immediately post the event to the registry. Capture once per correction event — not on every related follow-up turn.

**Trigger signals — fire when ANY of these are present:**

- **Direct correction:** "no", "stop", "don't do that", "you're wrong", "that's not right"
- **Frustrated redirect:** "you don't understand", "read the codebase", "i already told you"
- **Pattern instruction:** "always do X", "never do Y", "stop doing Z"
- **Repeated instruction:** same guidance given 2+ times in different ways within the session
- **Strong signal:** profanity directed at Claude's behavior, ALL CAPS frustration

**Do NOT fire if:**
- The user is correcting their own earlier instruction (only Claude's behavior triggers this)
- The same correction event has already been captured this turn
- The user is asking a clarifying question (not a correction)

```bash
~/.claude/scripts/post-correction.sh '{"project_name":"portage","category":"<category>","user_message":"<exact user message that triggered>","context":"<what Claude had just done that prompted the correction>","claude_action":"<what Claude SHOULD have done instead>","session_id":null,"tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

## Category values

| Category | When to use |
|----------|-------------|
| `docker-guessing` | Claude made infra changes without tracing the full request path first |
| `fabrication` | Claude invented something that doesn't exist — a file, function, API, or fact |
| `missed-context` | Claude didn't read CLAUDE.md, memory files, or existing code before responding |
| `wrong-assumption` | Claude assumed something specific to a different project or codebase |
| `repeated-instruction` | User had to repeat the same guidance already given in a prior turn |
| `workflow-violation` | Claude skipped a required step in /ship or another defined workflow |
| `other` | Correction doesn't fit any category above |

## Rules

- Fire-and-forget — don't stop work if the registry is down
- Don't ask permission to post — this is automated capture
- Capture ONCE per correction event, not on every turn in the same correction thread
- Escape single quotes in the JSON payload (use `'\''` in bash)
- Set `session_id` to the conversation/session ID if available, else `null`
- Include tags that would help future semantic search (e.g., `["docker","infra"]`, `["fabrication","routes"]`)
- Always use LAN IP `10.0.0.251:8011` — never localhost
- The `claude_action` field is the corrective lesson — be specific about what to do differently next time
