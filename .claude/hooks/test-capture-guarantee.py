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


if __name__ == "__main__":
    print("Running capture-guarantee tests...")
    test_all_missed()
    test_all_captured()
    test_partial()
    print("\nAll tests passed.")
