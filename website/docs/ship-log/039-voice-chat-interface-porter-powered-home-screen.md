---
title: "Voice chat interface — Porter-powered home screen with streaming, voice input, and TTS"
sidebar_label: "Voice chat interface — Porter-powered home screen"
sidebar_position: 39
---

# Voice chat interface — Porter-powered home screen with streaming, voice input, and TTS

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Backend only (Tasks 4, 6–10, 28) |
| **PR** | [https://github.com/sdnydude/portage/pull/87](https://github.com/sdnydude/portage/pull/87) |
| **Completed** | 2026-05-26 |
| **Model** | claude-sonnet-4-6 |

## Approach

Single SSE endpoint (`POST /porter/stream`) with `ReadableStream` on the frontend, local GPU inference via `dhg-stt` (Whisper Live large-v3-turbo) and `dhg-tts` (Chatterbox Turbo) on RTX 5080, home screen redesigned with Porter chat embedded. 31 tasks across 8 chunks.

## What shipped

- **SSE streaming**: `POST /porter/stream` emits `text_delta`, `tool_start`, `tool_result`, `action_pills`, `audio_url`, `done` events; `usePorterStream` hook parses via `ReadableStream` + manual Bearer auth header
- **Voice input**: `useVoiceInput` captures WebM/Opus, auto-stops on 2s silence via AnalyserNode, POSTs to `/porter/transcribe`
- **TTS output**: `/porter/speak` proxies to Chatterbox Turbo; `usePorterAudio` manages playback; `AudioPlayback` inline player
- **Home screen redesign**: Porter chat input embedded below greeting; engaged state (chat expands, listings collapse to swipe rail); full-screen chat overlay
- **Floating mic FAB**: Non-home tabs show FloatingMic that opens BottomSheet with voice overlay + response card
- **Rich content blocks**: `ToolBlock`, `InlineResultCard`, `CompTable`, `ActionPills`, `StreamingMessage` orchestration component
- **Action pills**: Porter appends `<actions>` XML; server parses + validates + strips + emits as SSE event
- **GPU services**: `dhg-stt` (port 8018) and `dhg-tts` (port 8019) added to docker-compose.yml with shared RTX 5080 passthrough
- **Advisor audit fixes (A1–A8)**: Input validation, resource leak fixes, stale-closure guards, GC pressure reduction, prompt injection hardening

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
- Livestream captioning integration (dhg-stt ready, needs batch job pipeline)
- Video archive captioning (dhg-stt ready, needs batch job pipeline)
- Voice cloning / custom Porter voice (dhg-tts supports reference audio)
- localStorage tokens to HttpOnly cookie migration (multi-day refactor, pre-existing)

## Key Decisions

- **Single SSE endpoint** over POST-then-GET: eliminates race condition where SSE client connects before response is buffered
- **Local GPU inference** over Cloudflare Workers AI: lower latency (~150ms TTS first byte), no per-request cost, data stays on LAN
- **Push-to-talk** over continuous listening: simpler state machine, avoids always-on mic concern
- **Text-only JSONB rebuild**: only `cleanText` (stripped of `<actions>`) persisted per turn; tool blocks not saved — intentional
