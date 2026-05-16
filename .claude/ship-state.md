status: in_progress
phase: 4
feature: Hook-driven capture — guaranteed registry ingest via session hooks instead of AI-discipline rules
approach: Python Stop hook parses session JSONL, count-based gap detection for insights + binary check for ship sessions
complexity: complex
spec:
  v1_scope: insights (count-based), ship_sessions (binary check)
  skip_v1: decisions, bug_fixes, corrections, deferred_items
  advisor_confirmed: true (3 rounds)
plan:
  task_1: Fix session ID bug in existing hooks (separate commit)
  task_2: Core parser — streaming JSONL, format validation, fail-open
  task_3: Insight detection + count-based gap + extraction
  task_4: Ship session detection (binary check)
  task_5: Parallel POST + log file + dry-run + wire settings.json
  task_6: Gut rules to stubs, delete sweep rule, test fixtures
known_limitations:
  - Count-based misses insight #2 if #3 captured but #2 wasn't (edge case)
  - Overcapture possible (harmless)
  - Stop hook stdout goes to log file not Claude
