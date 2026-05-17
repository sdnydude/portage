#!/usr/bin/env bash
# Cron target: age .remember journal files. Bash-only, no Claude session.
# Runs daily at 06:00 via crontab. Handles: rename past-day → done,
# roll 7+ day files into recent.md, archive overflow into archive.md.
set -euo pipefail

LOCKFILE="/tmp/journal-age.lock"
exec 9>"$LOCKFILE"
flock -n 9 || { echo "Already running, skipping."; exit 0; }

REMEMBER_DIR="/home/swebber64/DHG/portage/.remember"
TODAY=$(date +%Y-%m-%d)

# 1. Rename past days' today-*.md → today-*.done.md (skip today's file)
for f in "$REMEMBER_DIR"/today-????-??-??.md; do
  [ -f "$f" ] || continue
  DAY=$(basename "$f" .md | sed 's/today-//')
  [ "$DAY" = "$TODAY" ] && continue
  mv "$f" "${f%.md}.done.md"
done

# 2. Roll .done.md files older than 7 days into recent.md
RECENT="$REMEMBER_DIR/recent.md"
CUTOFF=$(date -d "7 days ago" +%Y-%m-%d)
[ -f "$RECENT" ] || echo "# Recent" > "$RECENT"

for f in "$REMEMBER_DIR"/today-????-??-??.done.md; do
  [ -f "$f" ] || continue
  [ -s "$f" ] || { rm "$f"; continue; }
  DAY=$(basename "$f" .done.md | sed 's/today-//')
  if [[ "$DAY" < "$CUTOFF" ]]; then
    echo "" >> "$RECENT"
    echo "## $DAY" >> "$RECENT"
    cat "$f" >> "$RECENT"
    rm "$f"
  fi
done

# 3. If recent.md > 50KB, move content older than 30 days to archive.md
ARCHIVE="$REMEMBER_DIR/archive.md"
RECENT_SIZE=$(stat -c%s "$RECENT" 2>/dev/null || echo 0)
if [ "$RECENT_SIZE" -gt 51200 ]; then
  [ -f "$ARCHIVE" ] || echo "# Archive" > "$ARCHIVE"
  ARCHIVE_CUTOFF=$(date -d "30 days ago" +%Y-%m-%d)
  python3 -c "
import re, sys

cutoff = '$ARCHIVE_CUTOFF'
recent = open('$RECENT').read()
sections = re.split(r'(## \d{4}-\d{2}-\d{2})', recent)

keep, archive = ['# Recent\n'], []
i = 1
while i < len(sections) - 1:
    header = sections[i]
    body = sections[i+1] if i+1 < len(sections) else ''
    day = header.replace('## ', '').strip()
    if day >= cutoff:
        keep.append(header + body)
    else:
        archive.append(header + body)
    i += 2

if archive:
    with open('$ARCHIVE', 'a') as f:
        f.write('\n'.join(archive))
    with open('$RECENT', 'w') as f:
        f.write('\n'.join(keep))
" 2>/dev/null || true
fi

# 4. Update last-full-sync timestamp
echo "$(date -u +'%Y-%m-%d %H:%M UTC')" > "$REMEMBER_DIR/.last-full-sync"
