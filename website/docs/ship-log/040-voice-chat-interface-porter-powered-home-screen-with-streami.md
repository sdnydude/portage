---
title: "Voice chat interface — Porter-powered home screen with streaming, voice input, and TTS"
sidebar_label: "Voice chat interface — Porter-powered home screen "
sidebar_position: 40
---

# Voice chat interface — Porter-powered home screen with streaming, voice input, and TTS

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/87](https://github.com/sdnydude/portage/pull/87) |
| **Completed** | 2026-05-26 |
| **Model** | claude-sonnet-4-6 |

## Approach

Single SSE endpoint (POST /porter/stream) with ReadableStream on the frontend, local GPU inference via dhg-stt (Whisper Live) and dhg-tts (Chatterbox Turbo) on RTX 5080, home screen redesigned with Porter chat embedded

## Commits

- `c2d7509 feat: add chatStream, shared Porter types, and dhg-stt/tts Docker services`
- `cc8cdde feat: add POST /porter/stream SSE endpoint with tool callbacks and TTS`
- `cf65b3f feat: add photos to search_inventory tool results`
- `6d4528b feat: add POST /porter/transcribe audio upload route`
- `50daddf feat: add POST /porter/speak TTS proxy route`
- `333d1c0 feat: export parseActionPills, update Porter system prompt`
- `022721d feat: add usePorterStream hook and porter UI components`
- `569335d feat: add voice input/audio hooks and voice UI components`
- `975a5e2 feat: evolve home page with Porter chat input and action pills`
- `3d7325d feat: engaged state transition`
- `3141f35 feat: full-screen chat overlay with slide-up animation`
- `44e0e57 feat: tab bar restructure, FloatingMic FAB, BottomSheet voice overlay`
- `fe52da2 feat: evolve conversation JSONB to blocks format`
- `7aecbe9 feat: proactive greeting with contextual hints`
- `d8c946c fix: Phase 6 review fixes — critical error handling`
- `3a087be docs: update TODO and CLAUDE.md`
- `99f664a fix: advisor audit findings A1-A8`

## Deferred Items

- WebSocket streaming transcription via dhg-stt (push-to-talk shipped; live captions need separate UI)
- Livestream captioning integration (dhg-stt ready, needs separate UI pipeline)
- Video archive captioning (batch job pipeline needed)
- Voice cloning / custom Porter voice (dhg-tts supports reference audio)
- localStorage tokens to HttpOnly cookie migration (multi-day refactor, pre-existing)

## Decisions

- Single SSE endpoint over POST-then-GET pattern (no race condition)
- Local GPU inference over Cloudflare Workers AI (latency, cost, privacy)
- Push-to-talk over continuous listening (simpler, avoids always-on mic concern)
- chatStream uses MessageStream API not AsyncGenerator (simpler with event emitters)
- Text-only JSONB rebuild intentional (tool blocks not persisted per turn)

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 8

## Verification

- **lint:** 0 errors, 23 warnings (all pre-existing)
- **tests:** 273/273 pass
- **typecheck:** pass

**Tags:** `voice`, `streaming`, `sse`, `tts`, `stt`, `porter`, `home-screen`, `audio`, `webrtc`

