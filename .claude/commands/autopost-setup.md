# /autopost-setup — Create a Registry Autopost Pipeline

Scaffold a complete autopost pipeline that captures Claude Code output to the DHG Registry database.

The user may have provided a data type: $ARGUMENTS

## What This Does

Creates all 6 artifacts needed for a new auto-capture pipeline:
1. SQLAlchemy model (appended to `registry/models.py`)
2. Alembic migration with tsvector trigger
3. Pydantic schemas (Create/Response/List/Search)
4. FastAPI endpoints (POST create, GET list, POST /search)
5. Shell capture script (`~/.claude/scripts/post-{slug}.sh`)
6. Behavioral rule (`.claude/rules/auto-{slug}-capture.md`)

Then deploys: docker cp → migration → container restart → smoke test.

## Execution

Use the Agent tool to spawn the `autopost-setup` agent:

```
Agent({
  description: "Create autopost pipeline",
  subagent_type: "general-purpose",
  prompt: "<include the full agent instructions from ~/.claude/agents/autopost-setup.md>"
})
```

Read the full agent definition from `/home/swebber64/.claude/agents/autopost-setup.md` and pass it as the agent prompt. If $ARGUMENTS was provided, prepend: "The user wants to auto-capture **$ARGUMENTS** to the DHG Registry. Use that as the data type — skip the clarification question and proceed directly to deriving naming conventions."

If no arguments were provided, the agent will ask what type of data to capture.

## Reference

The canonical reference implementation is the `insights` pipeline. The agent reads these files before generating anything:
- Registry source: `/home/swebber64/DHG/aifactory3.5/dhgaifactory3.5/registry/`
- Template doc: `/home/swebber64/.claude/projects/-home-swebber64-DHG-portage/memory/reference_autopost_template.md`
