#!/usr/bin/env python3
"""Stop hook: guaranteed capture of missed insights, ship sessions, decisions,
deferred items, corrections, and bug-fixes.

Parses the session JSONL transcript, detects capture-worthy events that weren't
followed by matching POST script calls, and fires the capture scripts for any gaps.

V3 adds: auto-fire for corrections (context-window extraction with deferred
resolution) and bug-fixes (commit message + diagnostic pattern scanning).

Design principles:
- Fail-open: never crash, never block, exit 0 always
- Stream-parse: line-by-line, handles 50MB+ files in <200ms
- Fire-and-forget: POSTs run in detached subprocesses
- Count-based detection: compares event count vs script call count
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
DECISION_FILE = re.compile(r"decision_[a-z]+_[a-z_]+\.md$")
CORRECTION_SIGNALS = re.compile(
    r"(don't do that|stop doing that|you're wrong|that's not right|that's wrong|stop that)",
    re.IGNORECASE,
)

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


def extract_deferred_items(ship_state_content: str) -> list[str]:
    """Extract deferred item strings from ship-state.md content."""
    items = []
    in_deferred = False
    for line in ship_state_content.split("\n"):
        if line.startswith("deferred:"):
            in_deferred = True
            continue
        if in_deferred:
            stripped = line.strip()
            if stripped.startswith("- "):
                item = stripped[2:].strip().strip('"')
                if item:
                    items.append(item)
            elif stripped and not line.startswith(" ") and not line.startswith("\t"):
                break
    return items


def parse_transcript(transcript: Path) -> dict[str, Any]:
    """Stream-parse the JSONL transcript and extract capture-relevant data."""
    insights_found: list[str] = []
    post_insight_count = 0
    ship_session_complete = False
    post_ship_session_called = False
    ship_state_content: str | None = None
    decisions_found: list[dict] = []
    post_decision_count = 0
    post_deferred_count = 0
    corrections_found: list[dict] = []
    pending_corrections: list[dict] = []
    post_correction_count = 0
    bug_fixes_found: list[dict] = []
    post_bug_fix_count = 0
    last_assistant_text = ""

    sample: list[dict] = []
    validated = False
    skipped_lines = 0
    total_lines = 0

    def process_entry(entry: dict) -> None:
        """Extract capture-relevant data from a single JSONL entry."""
        nonlocal post_insight_count, post_ship_session_called
        nonlocal ship_session_complete, ship_state_content
        nonlocal post_decision_count, post_deferred_count
        nonlocal post_correction_count, post_bug_fix_count
        nonlocal last_assistant_text

        entry_type = entry.get("type")

        if entry_type == "human":
            message = entry.get("message", {})
            msg_content = message.get("content", "")
            msg_text = ""
            if isinstance(msg_content, str):
                msg_text = msg_content
            elif isinstance(msg_content, list):
                for block in msg_content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        msg_text = block.get("text", "")
                        break
            if msg_text and CORRECTION_SIGNALS.search(msg_text):
                pending_corrections.append({
                    "user_message": msg_text[:500],
                    "context": last_assistant_text[-500:],
                })
            return

        if entry_type != "assistant":
            return

        message = entry.get("message", {})
        content = message.get("content", [])
        if not isinstance(content, list):
            return

        # Two-pass: collect text first, then process tool_use blocks.
        # Ensures last_assistant_text is current before diagnostic scans.
        current_text = ""
        text_blocks: list[str] = []
        tool_use_blocks: list[dict] = []

        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                text_blocks.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_use_blocks.append(block)

        # Process text blocks: resolve pending corrections, extract insights
        for text in text_blocks:
            current_text += text
            if pending_corrections:
                for pending in pending_corrections:
                    pending["claude_action"] = text[:500]
                    corrections_found.append(pending)
                pending_corrections.clear()
            if "★ Insight" in text:
                extracted = extract_insights_from_text(text)
                insights_found.extend(extracted)

        if current_text:
            last_assistant_text = current_text

        # Process tool_use blocks
        for block in tool_use_blocks:
            name = block.get("name", "")
            inp = block.get("input", {})

            if name == "Bash":
                cmd = inp.get("command", "")
                if "post-insight.sh" in cmd:
                    post_insight_count += 1
                elif "post-ship-session.sh" in cmd:
                    post_ship_session_called = True
                elif "post-decision-logs.sh" in cmd:
                    post_decision_count += 1
                elif "post-deferred-items.sh" in cmd:
                    post_deferred_count += 1
                elif "post-correction.sh" in cmd:
                    post_correction_count += 1
                elif "post-bug-fixes.sh" in cmd:
                    post_bug_fix_count += 1
                if "git commit" in cmd and "fix:" in cmd and not cmd.lstrip().startswith(("python", "node", "echo", "cat ")):
                    bug_fixes_found.append({
                        "commit_cmd": cmd,
                        "diagnostic_text": last_assistant_text,
                    })

            elif name in ("Write", "Edit"):
                file_path = inp.get("file_path", "")
                if "ship-state.md" in file_path:
                    file_content = inp.get("content", "") or inp.get("new_string", "")
                    if "status: complete" in file_content:
                        ship_session_complete = True
                        ship_state_content = file_content
                if DECISION_FILE.search(file_path):
                    decision_content = inp.get("content", "") or inp.get("new_string", "")
                    if decision_content:
                        decisions_found.append({"content": decision_content, "file_path": file_path})

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

    # Flush unresolved pending corrections (last-turn corrections with no follow-up)
    for pending in pending_corrections:
        pending["claude_action"] = ""
        corrections_found.append(pending)
    pending_corrections.clear()

    return {
        "valid": True,
        "insights_found": insights_found,
        "post_insight_count": post_insight_count,
        "ship_session_complete": ship_session_complete,
        "post_ship_session_called": post_ship_session_called,
        "ship_state_content": ship_state_content,
        "decisions_found": decisions_found,
        "post_decision_count": post_decision_count,
        "post_deferred_count": post_deferred_count,
        "corrections_found": corrections_found,
        "post_correction_count": post_correction_count,
        "bug_fixes_found": bug_fixes_found,
        "post_bug_fix_count": post_bug_fix_count,
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


def parse_decision_content(content: str) -> dict[str, str]:
    """Parse a decision file's frontmatter and body into payload fields."""
    parts = content.split("---")
    frontmatter = ""
    body = content
    if len(parts) >= 3:
        frontmatter = parts[1]
        body = "---".join(parts[2:]).strip()

    def fm_field(field: str) -> str:
        match = re.search(rf"^{field}:\s*(.+)$", frontmatter, re.MULTILINE)
        return match.group(1).strip() if match else ""

    title = fm_field("description") or fm_field("name")
    domain = fm_field("domain") or "other"

    choice = body
    alternatives = ""
    rationale = ""

    over_match = re.search(r"\*\*Over:\*\*\s*", body)
    because_match = re.search(r"\*\*Because:\*\*\s*", body)
    context_match = re.search(r"\*\*Context:\*\*\s*", body)

    if over_match:
        choice = body[:over_match.start()].strip()
        if because_match:
            alternatives = body[over_match.end():because_match.start()].strip()
            if context_match:
                rationale = body[because_match.end():context_match.start()].strip()
            else:
                rationale = body[because_match.end():].strip()
        else:
            alternatives = body[over_match.end():].strip()
    elif because_match:
        choice = body[:because_match.start()].strip()
        rationale = body[because_match.end():].strip()

    return {
        "title": title or "Untitled decision",
        "choice": choice[:2000],
        "alternatives_rejected": alternatives[:2000],
        "rationale": rationale[:2000],
        "domain": domain,
    }


def build_decision_payload(decision_data: dict) -> str | None:
    """Construct JSON payload for post-decision-logs.sh. Returns None if unparseable."""
    parsed = parse_decision_content(decision_data["content"])
    if parsed["title"] == "Untitled decision":
        logging.warning(f"Decision file has no parseable title, skipping: {decision_data.get('file_path', 'unknown')}")
        return None
    payload = {
        "title": parsed["title"],
        "choice": parsed["choice"],
        "alternatives_rejected": parsed["alternatives_rejected"],
        "rationale": parsed["rationale"],
        "domain": parsed["domain"],
        "project_name": "portage",
        "source_file": decision_data.get("file_path", ""),
        "tags": ["hook-guarantee"],
        "model_name": os.environ.get("ANTHROPIC_MODEL", "unknown"),
    }
    return json.dumps(payload)


def build_deferred_payload(item_text: str, feature_name: str) -> str:
    """Construct JSON payload for post-deferred-items.sh."""
    payload = {
        "title": item_text[:280],
        "description": item_text,
        "reason": "captured by hook-guarantee",
        "category": "other",
        "project_name": "portage",
        "source_context": feature_name or "unknown feature",
        "priority": "medium",
        "tags": ["hook-guarantee"],
        "model_name": os.environ.get("ANTHROPIC_MODEL", "unknown"),
    }
    return json.dumps(payload)


DIAGNOSTIC_PATTERNS = re.compile(
    r"(root cause|the bug was|the issue was|the problem was|caused by)[:\s]+(.{10,300})",
    re.IGNORECASE,
)


def build_correction_payload(correction: dict) -> str:
    """Construct JSON payload for post-correction.sh from a context window."""
    payload = {
        "project_name": "portage",
        "category": "other",
        "user_message": correction.get("user_message", "")[:500],
        "context": correction.get("context", "")[:500],
        "claude_action": correction.get("claude_action", "")[:500],
        "tags": ["hook-guarantee"],
        "model_name": os.environ.get("ANTHROPIC_MODEL", "unknown"),
    }
    return json.dumps(payload)


def build_bug_fix_payload(bug_fix: dict) -> str | None:
    """Construct JSON payload for post-bug-fixes.sh from commit + diagnostic text."""
    cmd = bug_fix.get("commit_cmd", "")
    # HEREDOC pattern: git commit -m "$(cat <<'EOF'\nfix: message\n..."
    msg_match = re.search(r"<<'?EOF'?\s*\n(fix:[^\n]+)", cmd)
    if not msg_match:
        msg_match = re.search(r'(?:-m|--message)[= ]\s*["\'](.+?)["\']', cmd)
    if not msg_match:
        msg_match = re.search(r"(?:-m|--message)[= ]\s*(\S+)", cmd)
    commit_msg = msg_match.group(1) if msg_match else cmd[:280]

    diagnostic = bug_fix.get("diagnostic_text", "")
    diag_match = DIAGNOSTIC_PATTERNS.search(diagnostic)
    root_cause = diag_match.group(2).strip() if diag_match else ""

    payload = {
        "tldr": commit_msg[:280],
        "symptom": "",
        "root_cause": root_cause[:500],
        "fix_applied": commit_msg[:500],
        "severity": "medium",
        "category": "other",
        "project_name": "portage",
        "tags": ["hook-guarantee"],
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
        with open(LOG_FILE, "a") as log_fh:
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

    decisions_found = result["decisions_found"]
    post_decision_count = result["post_decision_count"]
    missed_decision_count = len(decisions_found) - post_decision_count
    if missed_decision_count < 0:
        logging.warning(
            f"post-decision-logs called {post_decision_count}x but only "
            f"{len(decisions_found)} decision files detected — possible detection gap"
        )

    deferred_items: list[str] = []
    if result["ship_state_content"]:
        deferred_items = extract_deferred_items(result["ship_state_content"])
    post_deferred_count = result["post_deferred_count"]
    missed_deferred_count = len(deferred_items) - post_deferred_count
    if missed_deferred_count < 0:
        logging.warning(
            f"post-deferred-items called {post_deferred_count}x but only "
            f"{len(deferred_items)} deferred items detected — possible detection gap"
        )

    corrections_found = result["corrections_found"]
    post_correction_count = result["post_correction_count"]
    missed_correction_count = len(corrections_found) - post_correction_count
    if missed_correction_count < 0:
        logging.warning(
            f"post-correction called {post_correction_count}x but only "
            f"{len(corrections_found)} corrections detected — possible detection gap"
        )

    bug_fixes_found = result["bug_fixes_found"]
    post_bug_fix_count = result["post_bug_fix_count"]
    missed_bug_fix_count = len(bug_fixes_found) - post_bug_fix_count
    if missed_bug_fix_count < 0:
        logging.warning(
            f"post-bug-fixes called {post_bug_fix_count}x but only "
            f"{len(bug_fixes_found)} bug-fixes detected — possible detection gap"
        )

    if (missed_insight_count <= 0 and not ship_missed
            and missed_decision_count <= 0 and missed_deferred_count <= 0
            and missed_correction_count <= 0 and missed_bug_fix_count <= 0):
        logging.info(
            f"No missed captures (insights: {len(insights_found)}/{post_insight_count}; "
            f"decisions: {len(decisions_found)}/{post_decision_count}; "
            f"deferred: {len(deferred_items)}/{post_deferred_count}; "
            f"corrections: {len(corrections_found)}/{post_correction_count}; "
            f"bug-fixes: {len(bug_fixes_found)}/{post_bug_fix_count}; "
            f"ship: {'complete' if result['ship_session_complete'] else 'n/a'})"
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

    feature_name = ""
    if result["ship_state_content"]:
        fm = re.search(r"^feature:\s*(.+)$", result["ship_state_content"], re.MULTILINE)
        if fm:
            feature_name = fm.group(1).strip()

    posted_decisions = 0
    if missed_decision_count > 0:
        uncaptured = decisions_found[-missed_decision_count:]
        for decision in uncaptured:
            payload = build_decision_payload(decision)
            if payload is None:
                continue
            if DRY_RUN:
                print(f"[DRY-RUN] post-decision-logs.sh: {payload[:200]}...")
            else:
                fire_capture("post-decision-logs.sh", payload)
                posted_decisions += 1

    posted_deferred = 0
    if missed_deferred_count > 0:
        uncaptured = deferred_items[-missed_deferred_count:]
        for item in uncaptured:
            payload = build_deferred_payload(item, feature_name)
            if DRY_RUN:
                print(f"[DRY-RUN] post-deferred-items.sh: {payload[:200]}...")
            else:
                fire_capture("post-deferred-items.sh", payload)
                posted_deferred += 1

    posted_corrections = 0
    if missed_correction_count > 0:
        uncaptured = corrections_found[-missed_correction_count:]
        for corr in uncaptured:
            payload = build_correction_payload(corr)
            if DRY_RUN:
                print(f"[DRY-RUN] post-correction.sh: {payload[:200]}...")
            else:
                fire_capture("post-correction.sh", payload)
                posted_corrections += 1

    posted_bug_fixes = 0
    if missed_bug_fix_count > 0:
        uncaptured = bug_fixes_found[-missed_bug_fix_count:]
        for fix in uncaptured:
            payload = build_bug_fix_payload(fix)
            if payload is None:
                continue
            if DRY_RUN:
                print(f"[DRY-RUN] post-bug-fixes.sh: {payload[:200]}...")
            else:
                fire_capture("post-bug-fixes.sh", payload)
                posted_bug_fixes += 1

    summary = (
        f"capture-guarantee: posted {posted_insights} insights, {posted_ship} ship sessions, "
        f"{posted_decisions} decisions, {posted_deferred} deferred, "
        f"{posted_corrections} corrections, {posted_bug_fixes} bug-fixes"
    )
    logging.info(summary)
    if DRY_RUN:
        print(summary)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("Unexpected error in capture-guarantee hook")
    sys.exit(0)
