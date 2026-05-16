#!/usr/bin/env python3
"""Stop hook: guaranteed capture of missed insights and ship sessions.

Parses the session JSONL transcript, detects ★ Insight blocks and ship-session
completions that weren't followed by matching POST script calls, and fires the
capture scripts for any gaps.

Design principles:
- Fail-open: never crash, never block, exit 0 always
- Stream-parse: line-by-line, handles 50MB+ files in <200ms
- Fire-and-forget: POSTs run in detached subprocesses
- Count-based detection: compares insight count vs post-insight.sh call count
"""

import json
import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

LOG_DIR = Path.home() / ".claude" / "run"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "capture-guarantee.log"

logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)

DRY_RUN = "--dry-run" in sys.argv
SESSION_ID_OVERRIDE = None
for i, arg in enumerate(sys.argv):
    if arg == "--session-id" and i + 1 < len(sys.argv):
        SESSION_ID_OVERRIDE = sys.argv[i + 1]

INSIGHT_OPEN = re.compile(r"★ Insight[─`\s]*\n")
INSIGHT_CLOSE = re.compile(r"^\s*`?─{10,}`?\s*$", re.MULTILINE)

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"


def find_transcript() -> Path | None:
    """Locate the session JSONL transcript file."""
    session_id = SESSION_ID_OVERRIDE or os.environ.get("CLAUDE_CODE_SESSION_ID")
    if not session_id:
        logging.warning("No session ID available — cannot locate transcript")
        return None

    project_dir = Path(__file__).resolve().parent.parent.parent
    project_path = str(project_dir).replace("/", "-")
    if not project_path.startswith("-"):
        project_path = "-" + project_path

    transcript_dir = Path.home() / ".claude" / "projects" / project_path
    transcript = transcript_dir / f"{session_id}.jsonl"

    if transcript.exists():
        return transcript

    logging.warning(f"Transcript not found: {transcript}")
    return None


def validate_format(lines_sample: list[dict]) -> bool:
    """Check first N entries have expected structure."""
    if len(lines_sample) < 3:
        return False
    valid = sum(1 for entry in lines_sample if "type" in entry)
    return valid >= len(lines_sample) * 0.6


def extract_insights_from_text(text: str) -> list[str]:
    """Extract insight content from a text block containing ★ Insight markers."""
    insights = []
    parts = INSIGHT_OPEN.split(text)
    if len(parts) <= 1:
        return insights

    for part in parts[1:]:
        close_match = INSIGHT_CLOSE.search(part)
        if close_match:
            content = part[:close_match.start()].strip()
            content = re.sub(r"^[─`\s]+", "", content).strip()
        else:
            content = part.strip()[:2000]

        if content and len(content) > 20:
            insights.append(content)

    return insights


def parse_transcript(transcript: Path) -> dict[str, Any]:
    """Stream-parse the JSONL transcript and extract capture-relevant data."""
    insights_found: list[str] = []
    post_insight_count = 0
    ship_session_complete = False
    post_ship_session_called = False
    ship_state_content: str | None = None

    sample: list[dict] = []
    validated = False
    skipped_lines = 0
    total_lines = 0

    def process_entry(entry: dict) -> None:
        """Extract capture-relevant data from a single JSONL entry."""
        nonlocal post_insight_count, post_ship_session_called
        nonlocal ship_session_complete, ship_state_content

        if entry.get("type") != "assistant":
            return

        message = entry.get("message", {})
        content = message.get("content", [])
        if not isinstance(content, list):
            return

        for block in content:
            if not isinstance(block, dict):
                continue

            block_type = block.get("type")

            if block_type == "text":
                text = block.get("text", "")
                if "★ Insight" in text:
                    extracted = extract_insights_from_text(text)
                    insights_found.extend(extracted)

            elif block_type == "tool_use":
                name = block.get("name", "")
                inp = block.get("input", {})

                if name == "Bash":
                    cmd = inp.get("command", "")
                    if "post-insight.sh" in cmd:
                        post_insight_count += 1
                    elif "post-ship-session.sh" in cmd:
                        post_ship_session_called = True

                elif name in ("Write", "Edit"):
                    file_path = inp.get("file_path", "")
                    if "ship-state.md" in file_path:
                        file_content = inp.get("content", "") or inp.get("new_string", "")
                        if "status: complete" in file_content:
                            ship_session_complete = True
                            ship_state_content = file_content

    with open(transcript, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            total_lines += 1
            line = line.strip()
            if not line:
                continue

            try:
                entry = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                skipped_lines += 1
                continue

            if not validated:
                sample.append(entry)
                if len(sample) >= 5:
                    if not validate_format(sample):
                        logging.warning("JSONL format validation failed — bailing")
                        return {"valid": False}
                    validated = True
                    for buffered in sample:
                        process_entry(buffered)
                continue

            process_entry(entry)

    if skipped_lines > 0:
        skip_rate = skipped_lines / max(total_lines, 1)
        if skip_rate > 0.1:
            logging.warning(f"High skip rate: {skipped_lines}/{total_lines} lines unparseable ({skip_rate:.0%})")

    return {
        "valid": True,
        "insights_found": insights_found,
        "post_insight_count": post_insight_count,
        "ship_session_complete": ship_session_complete,
        "post_ship_session_called": post_ship_session_called,
        "ship_state_content": ship_state_content,
    }


def build_insight_payload(insight_text: str) -> str:
    """Construct JSON payload for post-insight.sh."""
    tldr = insight_text[:277].split("\n")[0]

    payload = {
        "tldr": tldr,
        "insight_statement": insight_text[:4000],
        "project_name": "portage",
        "category": "patterns",
        "tags": ["hook-guarantee"],
        "source": "hook-guarantee",
        "model_name": os.environ.get("ANTHROPIC_MODEL", "unknown"),
    }
    return json.dumps(payload)


def build_ship_session_payload(ship_state_content: str) -> str:
    """Construct JSON payload for post-ship-session.sh from ship-state content."""
    def extract_field(content: str, field: str) -> str:
        match = re.search(rf"^{field}:\s*(.+)$", content, re.MULTILINE)
        return match.group(1).strip() if match else ""

    payload = {
        "project_name": "portage",
        "feature": extract_field(ship_state_content, "feature"),
        "approach": extract_field(ship_state_content, "approach"),
        "status": "complete",
        "branch": os.environ.get("GIT_BRANCH", "unknown"),
        "tags": ["hook-guarantee"],
        "source": "hook-guarantee",
        "model_name": os.environ.get("ANTHROPIC_MODEL", "unknown"),
    }
    return json.dumps(payload)


def fire_capture(script_name: str, payload: str) -> None:
    """Fire a capture script in a detached subprocess. Stderr goes to log file."""
    script = SCRIPTS_DIR / script_name
    if not script.exists():
        script = Path.home() / ".claude" / "scripts" / script_name
    if not script.exists():
        logging.error(f"Script not found: {script_name}")
        return

    try:
        log_fh = open(LOG_FILE, "a")
        subprocess.Popen(
            ["bash", str(script), payload],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=log_fh,
        )
    except OSError as e:
        logging.error(f"Failed to fire {script_name}: {e}")


def main() -> None:
    transcript = find_transcript()
    if not transcript:
        logging.info("No transcript found — exiting")
        return

    logging.info(f"Parsing transcript: {transcript} ({transcript.stat().st_size / 1024:.0f} KB)")

    result = parse_transcript(transcript)

    if not result.get("valid"):
        logging.warning("Transcript invalid or unrecognized format — skipping")
        return

    insights_found = result["insights_found"]
    post_insight_count = result["post_insight_count"]
    missed_insight_count = len(insights_found) - post_insight_count

    ship_missed = result["ship_session_complete"] and not result["post_ship_session_called"]

    if missed_insight_count <= 0 and not ship_missed:
        logging.info(
            f"No missed captures (insights: {len(insights_found)} found, "
            f"{post_insight_count} posted; ship: {'complete' if result['ship_session_complete'] else 'n/a'})"
        )
        return

    # Fire missed captures — take the LAST N insights as uncaptured.
    # Known limitation: if AI skipped an earlier insight but captured a later one,
    # this heuristic may re-post the later one. Overcapture is acceptable (harmless).
    posted_insights = 0
    if missed_insight_count > 0:
        uncaptured = insights_found[-missed_insight_count:]
        for insight in uncaptured:
            payload = build_insight_payload(insight)
            if DRY_RUN:
                print(f"[DRY-RUN] post-insight.sh: {payload[:200]}...")
            else:
                fire_capture("post-insight.sh", payload)
                posted_insights += 1

    posted_ship = 0
    if ship_missed and result["ship_state_content"]:
        payload = build_ship_session_payload(result["ship_state_content"])
        if DRY_RUN:
            print(f"[DRY-RUN] post-ship-session.sh: {payload[:200]}...")
        else:
            fire_capture("post-ship-session.sh", payload)
            posted_ship = 1

    summary = f"capture-guarantee: posted {posted_insights} insights, {posted_ship} ship sessions"
    logging.info(summary)
    if DRY_RUN:
        print(summary)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("Unexpected error in capture-guarantee hook")
    sys.exit(0)
