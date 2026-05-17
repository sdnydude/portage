#!/usr/bin/env python3
"""Test suite for capture-guarantee.py using synthetic JSONL fixtures."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).parent / "capture-guarantee.py"


def make_assistant_text(text: str) -> str:
    """Create a JSONL line for an assistant message with text content."""
    entry = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [{"type": "text", "text": text}],
        },
        "timestamp": "2026-05-16T12:00:00.000Z",
    }
    return json.dumps(entry)


def make_assistant_tool_use(name: str, input_data: dict) -> str:
    """Create a JSONL line for an assistant message with a tool_use block."""
    entry = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [
                {
                    "type": "tool_use",
                    "id": "toolu_test",
                    "name": name,
                    "input": input_data,
                }
            ],
        },
        "timestamp": "2026-05-16T12:01:00.000Z",
    }
    return json.dumps(entry)


def make_human_text(text: str) -> str:
    """Create a JSONL line for a human message with text content."""
    entry = {
        "type": "human",
        "message": {"role": "user", "content": text},
        "timestamp": "2026-05-16T12:00:00.000Z",
    }
    return json.dumps(entry)


def make_metadata() -> list[str]:
    """Create initial JSONL metadata lines."""
    return [
        json.dumps({"type": "last-prompt", "leafUuid": "abc", "sessionId": "test"}),
        json.dumps({"type": "permission-mode", "permissionMode": "default", "sessionId": "test"}),
        json.dumps({"type": "bridge-session", "sessionId": "test", "bridgeSessionId": "b", "lastSequenceNum": 0}),
    ]


INSIGHT_TEXT = """`★ Insight ─────────────────────────────────────`
React useEffect cleanup functions run before the next effect, not on unmount.
This means stale closures are the default unless deps are managed carefully.
`─────────────────────────────────────────────────`"""

INSIGHT_TEXT_2 = """`★ Insight ─────────────────────────────────────`
PostgreSQL partial unique indexes enforce business rules at the DB layer
without requiring application-level locking or TOCTOU race protection.
`─────────────────────────────────────────────────`"""


def fixture_all_missed() -> str:
    """Two insights, one ship completion, zero capture calls."""
    lines = make_metadata()
    lines.append(make_assistant_text(f"Here's what I found:\n\n{INSIGHT_TEXT}"))
    lines.append(make_assistant_text(f"Another finding:\n\n{INSIGHT_TEXT_2}"))
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/project/.claude/ship-state.md",
        "content": "status: complete\nfeature: test feature\napproach: test approach\n",
    }))
    return "\n".join(lines) + "\n"


def fixture_all_captured() -> str:
    """Two insights with matching post calls, ship session captured."""
    lines = make_metadata()
    lines.append(make_assistant_text(f"Here's what I found:\n\n{INSIGHT_TEXT}"))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-insight.sh '{\"tldr\":\"React useEffect cleanup\"}'"
    }))
    lines.append(make_assistant_text(f"Another finding:\n\n{INSIGHT_TEXT_2}"))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-insight.sh '{\"tldr\":\"PostgreSQL partial indexes\"}'"
    }))
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/project/.claude/ship-state.md",
        "content": "status: complete\nfeature: test feature\n",
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-ship-session.sh '{\"feature\":\"test\"}'"
    }))
    return "\n".join(lines) + "\n"


def fixture_partial() -> str:
    """Three insights, one captured, two missed. No ship session."""
    lines = make_metadata()
    lines.append(make_assistant_text(f"Finding 1:\n\n{INSIGHT_TEXT}"))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-insight.sh '{\"tldr\":\"React cleanup\"}'"
    }))
    lines.append(make_assistant_text(f"Finding 2:\n\n{INSIGHT_TEXT_2}"))
    lines.append(make_assistant_text(
        f"Finding 3:\n\n`★ Insight ─────────────────────────────────────`\n"
        f"Fire-and-forget patterns must exit 0 to avoid blocking the caller.\n"
        f"`─────────────────────────────────────────────────`"
    ))
    return "\n".join(lines) + "\n"


DECISION_CONTENT = """---
name: decision-api-rest-over-mcp
description: REST adapters over MCP for shipping providers
type: decision
domain: api
supersedes: null
originSessionId: abc-123
---
Use REST adapters for Shippo and EasyPost.

**Over:** MCP server wrappers for each carrier API

**Because:** MCP exposes API keys to subprocess, adds process management complexity, and platform-managed keys are more secure

**Context:** Shipping provider integration, 2026-05-15
"""

DECISION_CONTENT_2 = """---
name: decision-infra-doppler
description: Doppler over self-hosted secrets management
type: decision
domain: infra
supersedes: null
originSessionId: def-456
---
Chose Doppler hosted SaaS.

**Over:** Vault and Infisical self-hosted

**Because:** CEO can't ops Vault; Infisical crash-loops without dedicated maintenance

**Context:** Secrets management selection, 2026-04
"""


def fixture_decisions_missed() -> str:
    """Two decision files written, zero post-decision-logs calls."""
    lines = make_metadata()
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/.claude/projects/-proj/memory/decision_api_rest_over_mcp.md",
        "content": DECISION_CONTENT,
    }))
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/.claude/projects/-proj/memory/decision_infra_doppler_over_vault.md",
        "content": DECISION_CONTENT_2,
    }))
    return "\n".join(lines) + "\n"


def fixture_deferred_missed() -> str:
    """Ship-state with 3 deferred items, 1 post-deferred call already made."""
    lines = make_metadata()
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/project/.claude/ship-state.md",
        "content": "status: complete\nfeature: test feature\ndeferred:\n  - JSON injection in session-capture.sh\n  - ARG_MAX risk in generate-ship-log.sh\n  - heredoc subshell fragility\n",
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-deferred-items.sh '{\"title\":\"JSON injection\"}'"
    }))
    return "\n".join(lines) + "\n"


def fixture_corrections_missed() -> str:
    """Correction signal with context window — no post-correction.sh call."""
    lines = make_metadata()
    lines.append(make_assistant_text("I'll refactor the auth module to use classes instead of functions."))
    lines.append(make_human_text("you're wrong, that's not how it works"))
    lines.append(make_assistant_text("You're right, I apologize. I'll keep the functional approach."))
    return "\n".join(lines) + "\n"


def fixture_corrections_captured() -> str:
    """Correction signal with matching post-correction.sh call — zero output expected."""
    lines = make_metadata()
    lines.append(make_assistant_text("I'll refactor the auth module to use classes."))
    lines.append(make_human_text("you're wrong, that's not how it works"))
    lines.append(make_assistant_text("You're right, I'll keep functional style."))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-correction.sh '{\"category\":\"wrong-assumption\"}'"
    }))
    return "\n".join(lines) + "\n"


def fixture_bug_fixes_missed() -> str:
    """Fix commit with diagnostic text — no post-bug-fixes.sh call."""
    lines = make_metadata()
    lines.append(make_assistant_text(
        "After investigating, the root cause was a stale closure in the useEffect hook "
        "that captured the old token value. The fix is to add the token to the dependency array."
    ))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "git commit -m \"fix: resolve null pointer in auth middleware\""
    }))
    return "\n".join(lines) + "\n"


def fixture_bug_fixes_captured() -> str:
    """Fix commit with matching post-bug-fixes.sh call — zero output expected."""
    lines = make_metadata()
    lines.append(make_assistant_text("The root cause was a missing null check."))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "git commit -m \"fix: add null guard to auth flow\""
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-bug-fixes.sh '{\"tldr\":\"null guard\"}'"
    }))
    return "\n".join(lines) + "\n"


def fixture_v2_all_captured() -> str:
    """Decisions + deferred items all properly captured. Zero output expected."""
    lines = make_metadata()
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/.claude/projects/-proj/memory/decision_api_test_choice.md",
        "content": DECISION_CONTENT,
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-decision-logs.sh '{\"title\":\"test\"}'"
    }))
    lines.append(make_assistant_tool_use("Write", {
        "file_path": "/home/user/project/.claude/ship-state.md",
        "content": "status: complete\nfeature: test\ndeferred:\n  - item1\n",
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-deferred-items.sh '{\"title\":\"item1\"}'"
    }))
    lines.append(make_assistant_tool_use("Bash", {
        "command": "~/.claude/scripts/post-ship-session.sh '{\"feature\":\"test\"}'"
    }))
    return "\n".join(lines) + "\n"


def run_dry_run(fixture_content: str) -> str:
    """Write fixture to temp file and run capture-guarantee in dry-run mode."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(fixture_content)
        fixture_path = f.name

    session_id = Path(fixture_path).stem
    project_path = "-home-swebber64-DHG-portage"
    target_dir = Path.home() / ".claude" / "projects" / project_path
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{session_id}.jsonl"

    os.rename(fixture_path, str(target))

    try:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--dry-run", "--session-id", session_id],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout
    finally:
        target.unlink(missing_ok=True)


def test_all_missed():
    output = run_dry_run(fixture_all_missed())
    assert output.count("[DRY-RUN] post-insight.sh") == 2, f"Expected 2 insights, got: {output}"
    assert "[DRY-RUN] post-ship-session.sh" in output, f"Expected ship session, got: {output}"
    print("  PASS: all_missed — 2 insights + 1 ship session detected")


def test_all_captured():
    output = run_dry_run(fixture_all_captured())
    assert output.strip() == "", f"Expected no output, got: {output!r}"
    print("  PASS: all_captured — zero output (no false positives)")


def test_partial():
    output = run_dry_run(fixture_partial())
    assert output.count("[DRY-RUN] post-insight.sh") == 2, f"Expected 2 missed insights, got: {output}"
    assert "post-ship-session.sh" not in output, f"Unexpected ship session in: {output}"
    print("  PASS: partial — 2 missed insights, no ship session")


def test_decisions_missed():
    output = run_dry_run(fixture_decisions_missed())
    assert output.count("[DRY-RUN] post-decision-logs.sh") == 2, f"Expected 2 decisions, got: {output}"
    assert "REST adapters" in output, f"Expected parsed content in payload: {output}"
    print("  PASS: decisions_missed — 2 decisions detected with parsed content")


def test_deferred_missed():
    output = run_dry_run(fixture_deferred_missed())
    assert output.count("[DRY-RUN] post-deferred-items.sh") == 2, f"Expected 2 deferred, got: {output}"
    assert "post-decision-logs.sh" not in output, f"Unexpected decision in: {output}"
    print("  PASS: deferred_missed — 2 deferred items detected (3 found, 1 already posted)")


def test_corrections_missed():
    output = run_dry_run(fixture_corrections_missed())
    assert "[DRY-RUN] post-correction.sh" in output, f"Expected correction fire, got: {output}"
    assert "you're wrong" in output or "you\\u0027re wrong" in output, f"Expected user_message in payload: {output}"
    print("  PASS: corrections_missed — correction auto-fired with context window")


def test_corrections_captured():
    output = run_dry_run(fixture_corrections_captured())
    assert "post-correction.sh" not in output, f"Expected no correction fire, got: {output}"
    print("  PASS: corrections_captured — no false positives")


def test_bug_fixes_missed():
    output = run_dry_run(fixture_bug_fixes_missed())
    assert "[DRY-RUN] post-bug-fixes.sh" in output, f"Expected bug-fix fire, got: {output}"
    assert "null pointer" in output, f"Expected commit message in payload: {output}"
    print("  PASS: bug_fixes_missed — bug-fix auto-fired with diagnostic extraction")


def test_bug_fixes_captured():
    output = run_dry_run(fixture_bug_fixes_captured())
    assert "post-bug-fixes.sh" not in output, f"Expected no bug-fix fire, got: {output}"
    print("  PASS: bug_fixes_captured — no false positives")


def test_v2_all_captured():
    output = run_dry_run(fixture_v2_all_captured())
    assert output.strip() == "", f"Expected no output, got: {output!r}"
    print("  PASS: v2_all_captured — zero false positives for decisions+deferred")


if __name__ == "__main__":
    print("Running capture-guarantee tests...")
    test_all_missed()
    test_all_captured()
    test_partial()
    test_decisions_missed()
    test_deferred_missed()
    test_corrections_missed()
    test_corrections_captured()
    test_bug_fixes_missed()
    test_bug_fixes_captured()
    test_v2_all_captured()
    print("\nAll tests passed.")
