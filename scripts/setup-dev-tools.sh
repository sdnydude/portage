#!/usr/bin/env bash
set -euo pipefail

echo "=== Portage Dev Tools Setup ==="
echo ""

ERRORS=0

# 1. Claude Code plugins
echo "--- Claude Code Plugins ---"

for plugin in "tdd-guard@tdd-guard" "pr-review-toolkit@claude-plugins-official" "superpowers@claude-plugins-official"; do
  name="${plugin%%@*}"
  if claude plugins list 2>/dev/null | grep -q "$name"; then
    echo "  ✓ $name (already installed)"
  else
    echo "  → Installing $name..."
    claude plugins install "$plugin" --scope user 2>&1 || { echo "  ✗ Failed to install $name"; ERRORS=$((ERRORS+1)); }
  fi
done

echo ""

# 2. npm global tools
echo "--- npm Global Tools ---"

if command -v claudekit &>/dev/null; then
  echo "  ✓ claudekit $(claudekit --version 2>/dev/null)"
else
  echo "  → Installing claudekit..."
  npm install -g claudekit 2>&1 || { echo "  ✗ Failed to install claudekit"; ERRORS=$((ERRORS+1)); }
fi

echo ""

# 3. ccpm skill
echo "--- ccpm Skill ---"

if [ -d "$HOME/.claude/skills/ccpm" ]; then
  echo "  ✓ ccpm (already installed)"
else
  echo "  → Cloning ccpm..."
  mkdir -p "$HOME/tools"
  if [ ! -d "$HOME/tools/ccpm" ]; then
    git clone --depth 1 https://github.com/automazeio/ccpm.git "$HOME/tools/ccpm" 2>&1
  fi
  mkdir -p "$HOME/.claude/skills"
  ln -sf "$HOME/tools/ccpm/skill/ccpm" "$HOME/.claude/skills/ccpm"
  echo "  ✓ ccpm installed"
fi

echo ""

# 4. CLI tools check
echo "--- CLI Tools ---"

for cmd in gh docker curl git; do
  if command -v "$cmd" &>/dev/null; then
    echo "  ✓ $cmd"
  else
    echo "  ✗ $cmd not found — install manually"
    ERRORS=$((ERRORS+1))
  fi
done

if command -v npx &>/dev/null; then
  echo "  ✓ npx (AgentShield runs via npx, no install needed)"
else
  echo "  ✗ npx not found — install Node.js"
  ERRORS=$((ERRORS+1))
fi

echo ""

# 5. Summary
if [ "$ERRORS" -eq 0 ]; then
  echo "=== All tools installed. Run /ship_v3 in Claude Code. ==="
else
  echo "=== Done with $ERRORS issue(s) — see above. ==="
fi
