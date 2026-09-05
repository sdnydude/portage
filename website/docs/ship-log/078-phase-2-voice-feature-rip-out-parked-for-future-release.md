---
title: "Phase 2: voice feature rip-out (parked for future release)"
sidebar_label: "Phase 2: voice feature rip-out (parked for future "
sidebar_position: 78
slug: ship-32595eef
registry_id: 32595eef-5d0d-49eb-bed1-463a9ffb0b72
generated: true
---

# Phase 2: voice feature rip-out (parked for future release)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#146](https://github.com/sdnydude/portage/pull/146) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

Worktree-isolated removal per approved 7-phase plan: tag voice-parked-2026-07 pushed first (restore = checkout); web strip (7 files deleted, BottomSheet had zero callers), API strip (transcribe/speak/stream-TTS), shared types (AudioEvent/AudioPlayback/voiceTranscript), infra (dhg-stt+dhg-tts out of compose). Gate: rebuilt containers, live e2e proving Porter text chat streams (2nd-marker-occurrence assertion to defeat user-bubble false-pass), authed voice routes 404 live, proof screenshots. Ephemeral CI cannot reach an LLM, so live chat test env-gated behind E2E_PORTER_LIVE=1.

## Commits

- f09bca6 refactor(web): remove voice UI
- 45dbdcc refactor(api): remove transcribe/speak/stream TTS
- 0c8a261 refactor(shared): drop audio types
- e120a24 chore(infra): remove stt/tts services
- bd51e57 docs: record removal
- 6d7a855 test(e2e): live gate proof
- 4d7e5a5 test(e2e): gate live chat behind E2E_PORTER_LIVE

## Decisions

- Live-LLM e2e split: UI-absence assertions run in ephemeral CI, live chat exchange env-gated E2E_PORTER_LIVE=1 (repo E2E_EBAY_LIVE convention)
- DHG_STT_URL/DHG_TTS_URL were never in env.ts Zod schema — porter read process.env directly; only .env.example needed the drop

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (0 errors)
- **tests:** api 537 + web 225 + e2e 3 (live) green; net -1459 lines
- **typecheck:** pass

**Tags:** `voice`, `porter`, `removal`, `phase-2`
