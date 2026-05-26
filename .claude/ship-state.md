status: complete
phase: 7
pr: https://github.com/sdnydude/portage/pull/87
completed_at: 2026-05-26T21:00:00Z
feature: Voice chat interface — Porter-powered home screen with rich chat UI, SSE streaming, push-to-talk voice via dhg-stt, and spoken responses via dhg-tts
approach: Single ship with everything. Rich chat (tool blocks, inline cards, action pills) + home redesign + SSE streaming + voice input via dhg-stt (WhisperLive) + TTS via dhg-tts (Chatterbox Turbo). Both GPU services on RTX 5080. Prebuilt containers validated before build.
complexity: complex
tdd: backend_only
branch: feat/voice-chat

advisor_audit:
  - C1: Single SSE endpoint (not POST-then-GET race)
  - C2: Structured tool results with photos (not plain text)
  - C3: fetch() + ReadableStream for SSE auth (not EventSource)
  - C4: SDK has both create({stream:true}) AND .stream() — using .stream() (MessageStream with .on('text'), .on('contentBlock'), .finalMessage())
  - C5: Tool execution managed outside stream — detect tool_use blocks, execute, re-queue results in new stream
  - C6: usePorterStream bypasses api() wrapper — raw fetch with Bearer header
  - C7: Docker images validated in Task 0 before any build work
  - C8: Env vars DHG_STT_URL/DHG_TTS_URL added to config after Task 0 validation
  - I1: FAB collision resolved — Scan FAB on home only, FloatingMic on other tabs
  - I2: Rate limit reuses existing porterMessagesToday counting logic
  - I3: Auth token expiry mid-stream accepted risk (15min tokens, <60s streams)
  - I4: pulse-ring + waveform keyframes added in Task 19
  - I5: Audio MIME codec suffix handled — parse before semicolon
  - I6: Action pills parsing in Task 6 stream handler, prompt in Task 10
  - I7: Home page evolved (not replaced) — preserves useDashboard integration
  - I8: Multer import explicitly added in Task 8
  - I9: Per-task dependency annotations added

model_assignments:
  opus:
    - Task 6 (POST /porter/stream) — SSE + rate limit + tool callbacks + TTS trigger + JSONB, all must compose correctly
    - Task 11 (usePorterStream hook) — raw SSE parsing, manual auth, conversation state machine
    - Task 22 (Evolve home page) — must preserve useDashboard() while grafting streaming chat
    - Task 28 (JSONB backward compat) — old {role,content:string} → new {role,blocks:ContentBlock[]} migration
  sonnet: all remaining tasks (5, 7-10, 12-21, 23-27, 29-30)

plan: 31 tasks (0-30) across 8 chunks
  chunk_0_validation: Task 0 (pull + validate Docker images)
  chunk_1_infrastructure: Tasks 1-5 (dhg-stt, dhg-tts, VRAM test, chatStream, shared types)
  chunk_2_api_routes: Tasks 6-10 (SSE endpoint, photos in tools, transcribe route, speak route, prompt)
  chunk_3_rich_chat: Tasks 11-16 (usePorterStream, ToolBlock, ResultCard, CompTable, ActionPills, StreamingMessage)
  chunk_4_voice_and_audio: Tasks 17-21 (useVoiceInput, usePorterAudio, VoiceButton+keyframes, AudioPlayback, VoiceOverlay)
  chunk_5_home_redesign: Tasks 22-25 (home page evolution, engaged state, full-screen chat, tab bar+FAB)
  chunk_6_floating_mic: Tasks 26-27 (FloatingMic FAB, BottomSheet)
  chunk_7_integration: Tasks 28-30 (JSONB evolution, greeting logic, E2E test)

deferred:
  - Real-time streaming transcription via WebSocket (dhg-stt supports it)
  - Livestream captioning integration
  - Video archive captioning
  - Voice cloning / custom Porter voice
  - Conversation search/history browser
  - Watcher/price-change notification system
