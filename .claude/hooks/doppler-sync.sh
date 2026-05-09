#!/usr/bin/env bash
# Sync .env from Doppler on session start (if doppler is configured for this directory)
# Runs silently — only outputs on error

if ! command -v doppler &>/dev/null; then
  exit 0
fi

if ! doppler secrets download --no-file --format env &>/dev/null; then
  exit 0
fi

doppler secrets download --no-file --format env > .env 2>/dev/null

echo "Doppler: synced $(grep -c '=' .env 2>/dev/null || echo 0) secrets to .env"
