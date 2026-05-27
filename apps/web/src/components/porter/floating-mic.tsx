"use client";

import { useState, useEffect, useRef } from "react";
import { usePorter } from "@/hooks/use-porter-context";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useAuth } from "@/hooks/use-auth";
import { StreamingMessage } from "@/components/porter/streaming-message";

export function FloatingMic() {
  const porter = usePorter();
  const voice = useVoiceInput();
  const { token } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sentRef = useRef(false);

  // Send transcript to Porter once when transcription completes
  useEffect(() => {
    if (voice.state === "done" && voice.transcript && !sentRef.current) {
      sentRef.current = true;
      porter.sendMessage(voice.transcript);
    }
    if (voice.state === "idle") {
      sentRef.current = false;
    }
  }, [voice.state, voice.transcript, porter]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!token) return;
    sentRef.current = false;
    setIsSheetOpen(true);
    voice.start(token);
  };

  const handlePointerUp = () => {
    voice.stop();
  };

  const handleClose = () => {
    voice.reset();
    setIsSheetOpen(false);
  };

  const handlePillSelect = (message: string) => {
    porter.sendMessage(message);
  };

  const isRecording = voice.state === "listening";
  const isTranscribing = voice.state === "transcribing";
  const lastAssistantMessage = porter.messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant");

  return (
    <>
      {/* PTT FAB */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Push to talk"
        className="fixed z-40 flex items-center justify-center rounded-full text-white select-none touch-none"
        style={{
          bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
          right: "18px",
          width: "52px",
          height: "52px",
          backgroundColor: isRecording ? "#dc2626" : "var(--forest-green)",
          boxShadow: isRecording
            ? "0 0 0 8px rgba(220,38,38,0.18), 0 4px 20px rgba(0,0,0,0.18), 0 0 0 3px var(--background)"
            : "0 4px 20px rgba(0,0,0,0.15), 0 0 0 3px var(--background)",
          transition: "background-color 0.15s ease, box-shadow 0.2s ease",
        }}
      >
        {isTranscribing ? (
          // Spinner while transcribing
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ) : (
          // Mic icon
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
          </svg>
        )}
      </button>

      {/* Bottom sheet */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* Sheet */}
          <div
            className="relative w-full rounded-t-3xl bg-[var(--background)] border-t border-[var(--border)]"
            style={{
              animation: "slide-up 0.28s ease-out",
              maxHeight: "65vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border)]">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-[family-name:var(--font-instrument)] font-bold text-white text-sm flex-shrink-0 select-none"
                style={{ background: "linear-gradient(135deg, #4a8a3e 0%, #2D5A27 100%)" }}
              >
                P
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">Porter</p>
                <p className="text-text-secondary text-xs">
                  {isRecording
                    ? "Listening — release to send"
                    : isTranscribing
                    ? "Processing…"
                    : porter.isStreaming
                    ? "Thinking…"
                    : "Ready"}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)" }}
            >
              {/* Listening waveform */}
              {isRecording && (
                <div className="flex items-center justify-center gap-1 py-6">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-red-500"
                      style={{
                        height: "20px",
                        animation: "waveform-bar 0.75s ease-in-out infinite",
                        animationDelay: `${i * 0.09}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Transcript shown after recording */}
              {voice.transcript && (
                <div className="flex justify-end">
                  <div className="bg-[var(--forest-green)] text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm max-w-[85%]">
                    {voice.transcript}
                  </div>
                </div>
              )}

              {/* Voice error */}
              {voice.error && (
                <p className="text-red-500 text-sm text-center">{voice.error}</p>
              )}

              {/* Porter streaming response */}
              {porter.isStreaming && (
                <StreamingMessage
                  streamingBlocks={porter.streamingBlocks}
                  isStreaming={porter.isStreaming}
                />
              )}

              {/* Porter's last assistant message (when not streaming) */}
              {!porter.isStreaming && lastAssistantMessage && voice.transcript && (
                <StreamingMessage
                  message={lastAssistantMessage}
                  pills={porter.pills}
                  audioUrl={porter.audioUrl}
                  onPillSelect={handlePillSelect}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
