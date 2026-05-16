#!/usr/bin/env bash
# Generate Docusaurus ship-log pages from the DHG Registry API
# Usage: generate-ship-log.sh [project_name] [output_dir]
#
# Fetches all ship sessions from the registry and generates:
#   - output_dir/ship-log/index.md (overview page)
#   - output_dir/ship-log/NNN-slug.md (one page per session, numbered for ordering)

set -euo pipefail

PROJECT="${1:-portage}"
OUTPUT_DIR="${2:-/home/swebber64/DHG/portage/website/docs}"
REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"

SHIP_LOG_DIR="$OUTPUT_DIR/ship-log"
mkdir -p "$SHIP_LOG_DIR"

# Fetch all sessions
RAW=$(curl -s --connect-timeout 5 --max-time 10 \
  "$REGISTRY_URL/api/ship-sessions?project_name=$PROJECT&limit=100" 2>/dev/null)

if [ -z "$RAW" ]; then
  echo "ERROR: Could not reach registry at $REGISTRY_URL" >&2
  exit 1
fi

# Generate pages via Python (complex JSON → markdown)
python3 - "$RAW" "$SHIP_LOG_DIR" <<'PYEOF'
import sys, json, re, os
from datetime import datetime

raw = sys.argv[1]
out_dir = sys.argv[2]
data = json.loads(raw)
sessions = data.get("ship_sessions", [])

# Sort by created_at ascending (oldest first for numbering)
sessions.sort(key=lambda s: s.get("created_at", ""))

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')[:60]

def escape_mdx(text):
    """Escape angle brackets so MDX doesn't interpret them as JSX tags."""
    return text.replace('<', '\\<').replace('>', '\\>')


def fmt_date(iso_str):
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return iso_str[:10]

# --- Generate index page ---
index_lines = [
    "---",
    "title: Ship Log",
    "sidebar_label: Ship Log",
    "sidebar_position: 0",
    "---",
    "",
    "# Ship Log",
    "",
    f"Structured records of every `/ship` workflow run for **{sessions[0].get('project_name', 'portage') if sessions else 'portage'}**.",
    f"Total: **{len(sessions)}** sessions.",
    "",
    "| # | Feature | Status | PR | Deferred |",
    "|---|---------|--------|----|----------|",
]

for i, s in enumerate(sessions, 1):
    feature = (s.get("feature") or "?")[:60]
    status = s.get("status", "?")
    pr = s.get("pr_url")
    pr_text = f"[#{pr.split('/')[-1]}]({pr})" if pr else "—"
    deferred_count = len(s.get("deferred") or [])
    slug = slugify(s.get("feature", "session"))
    filename = f"{i:03d}-{slug}"
    index_lines.append(f"| {i} | [{feature}]({filename}) | {status} | {pr_text} | {deferred_count} |")

index_path = os.path.join(out_dir, "index.md")
with open(index_path, "w") as f:
    f.write("\n".join(index_lines) + "\n")
print(f"  index: {index_path}")

# --- Generate per-session pages ---
for i, s in enumerate(sessions, 1):
    slug = slugify(s.get("feature", "session"))
    filename = f"{i:03d}-{slug}"
    feature = s.get("feature", "Untitled")
    status = s.get("status", "?")
    complexity = s.get("complexity") or "—"
    tdd = "Yes" if s.get("tdd") else "No" if s.get("tdd") is False else "—"
    pr = s.get("pr_url")
    pr_text = f"[{pr}]({pr})" if pr else "—"
    approach = s.get("approach") or "—"
    completed = fmt_date(s.get("completed_at"))
    created = fmt_date(s.get("created_at"))
    branch = s.get("branch") or "—"
    model = s.get("model_name") or "—"

    lines = [
        "---",
        f'title: "{feature}"',
        f'sidebar_label: "{feature[:50]}"',
        f"sidebar_position: {i}",
        "---",
        "",
        f"# {feature}",
        "",
        "| Field | Value |",
        "|-------|-------|",
        f"| **Status** | {status} |",
        f"| **Complexity** | {complexity} |",
        f"| **TDD** | {tdd} |",
        f"| **PR** | {pr_text} |",
        f"| **Completed** | {completed} |",
        f"| **Model** | {model} |",
        "",
    ]

    if approach != "—":
        lines += ["## Approach", "", escape_mdx(approach), ""]

    commits = s.get("commits") or []
    if commits:
        lines += ["## Commits", ""]
        for c in commits:
            lines.append(f"- `{escape_mdx(c)}`")
        lines.append("")

    deferred = s.get("deferred") or []
    if deferred:
        lines += ["## Deferred Items", ""]
        for d in deferred:
            lines.append(f"- {escape_mdx(d)}")
        lines.append("")

    surprises = s.get("surprises") or []
    if surprises:
        lines += ["## Surprises", ""]
        for sp in surprises:
            lines.append(f"- {escape_mdx(sp)}")
        lines.append("")

    decisions = s.get("decisions") or []
    if decisions:
        lines += ["## Decisions", ""]
        for dec in decisions:
            lines.append(f"- {escape_mdx(dec)}")
        lines.append("")

    review = s.get("review")
    if review:
        lines += ["## Review", ""]
        agents = review.get("agents") or []
        if agents:
            lines.append(f"**Agents:** {', '.join(agents)}")
        crit = review.get("critical_found")
        imp = review.get("important_found")
        if crit is not None:
            lines.append(f"**Critical issues found:** {crit}")
        if imp is not None:
            lines.append(f"**Important issues found:** {imp}")
        lines.append("")

    verification = s.get("verification")
    if verification:
        lines += ["## Verification", ""]
        for k, v in verification.items():
            lines.append(f"- **{k}:** {v}")
        lines.append("")

    tags = s.get("tags") or []
    if tags:
        lines.append(f"**Tags:** {', '.join(f'`{t}`' for t in tags)}")
        lines.append("")

    page_path = os.path.join(out_dir, f"{filename}.md")
    with open(page_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  {filename}.md")

print(f"\nGenerated {len(sessions)} ship-log pages + index")
PYEOF
