status: in_progress
phase: 4
feature: Critical code health fixes — ILIKE escape, AI tool loop cap, stub shipping guard
approach: 3 targeted fixes in existing files, no new files, no schema changes
complexity: simple
spec:
  1. ILIKE wildcard escape in admin.ts and porter.ts (reuse items.ts pattern)
  2. MAX_TOOL_ITERATIONS cap in ai-client.ts chatAnthropic and chatOpenAI
  3. Stub shipping label purchase returns data without mutating order state
