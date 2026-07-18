---
title: "Voice chat interface — Porter-powered voice control with redesigned home screen"
sidebar_label: "Voice chat interface — Porter-powered voice contro"
sidebar_position: 39
---

# Voice chat interface — Porter-powered voice control with redesigned home screen

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/87](https://github.com/sdnydude/portage/pull/87) |
| **Completed** | 2026-05-26 |
| **Model** | claude-sonnet-4-6 |

## Approach

Rich chat UI + SSE streaming via client.messages.stream() + home redesign + voice I/O (dhg-stt/dhg-tts prebuilt containers) + floating mic + JSONB migration

## Commits

- `d8c946c fix: Phase 6 review fixes`
- `7aecbe9 feat: proactive greeting`
- `fe52da2 feat: JSONB blocks format`
- `44e0e57 feat: tab bar + FloatingMic + BottomSheet`
- `3141f35 feat: full-screen chat overlay`
- `3d7325d feat: engaged state transition`
- `975a5e2 feat: evolve home page`
- `569335d feat: voice hooks + UI components`
- `022721d feat: usePorterStream + porter UI`
- `333d1c0 feat: parseActionPills + system prompt`
- `50daddf feat: POST /porter/speak`
- `6d4528b feat: POST /porter/transcribe`
- `cf65b3f feat: photos in search_inventory`
- `cc8cdde feat: POST /porter/stream SSE`

## Deferred Items

- Real-time WebSocket transcription — dhg-stt supports it; defer until push-to-talk proven
- Voice cloning via Chatterbox reference audio
- TTS auto-play on home page — AudioPlayback handles manual play
- Conversation search/history browser
- porter-transcribe MIME filter strictness

## Decisions

- SSE over WebSocket for streaming — simpler auth, works with fetch() Bearer, no protocol upgrade needed
- `client.messages.stream()` over `create({stream:true})` — higher-level API with on(text)/on(contentBlock)/finalMessage()
- sseStarted flag for SSE error handling fork — next(err) pre-headers, SSE error event post-headers
- PorterProvider React Context — lifts usePorterStream into tabs layout so home and FloatingMic share state
- lazy JSONB migration — normalizeConversationMessages() on load, zero-downtime backward compat

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 5

## Verification

- **lint:** 0 errors, 23 pre-existing warnings
- **tests:** 270/270
- **typecheck:** pass

**Tags:** `voice`, `porter`, `sse`, `streaming`, `tts`, `stt`, `home-redesign`, `react-context`

