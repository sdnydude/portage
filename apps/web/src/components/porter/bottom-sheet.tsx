"use client";

import { useState } from "react";
import { VoiceOverlay } from "./voice-overlay";
import { StreamingMessage } from "./streaming-message";
import { ActionPills } from "./action-pills";
import { usePorter } from "@/hooks/use-porter-context";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useAuth } from "@/hooks/use-auth";

interface BottomSheetProps {
  onClose: () => void;
}

type SheetState = "idle" | "voice" | "response";

export function BottomSheet({ onClose }: BottomSheetProps) {
  const { token } = useAuth();
  const porter = usePorter();
  const voice = useVoiceInput();
  const [sheetState, setSheetState] = useState<SheetState>("idle");
  const [localInput, setLocalInput] = useState("");

  const handleVoiceSend = (text: string) => {
    porter.setIsEngaged(true);
    porter.sendMessage(text);
    setSheetState("response");
    voice.reset();
  };

  const handleVoiceCancel = () => {
    voice.reset();
    setSheetState("idle");
  };

  const handleStartListening = async () => {
    if (token) {
      await voice.start(token);
      setSheetState("voice");
    }
  };

  const handleTextSend = () => {
    const text = localInput.trim();
    if (!text || porter.isStreaming) return;
    setLocalInput("");
    porter.setIsEngaged(true);
    porter.sendMessage(text);
    setSheetState("response");
  };

  const voiceOverlayState =
    voice.state === "listening"
      ? "listening"
      : voice.state === "transcribing"
      ? "transcribing"
      : "processing";

  const lastAssistantMessage = porter.messages.findLast((m) => m.role === "assistant");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[58] bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[59] max-w-lg mx-auto animate-slide-up-full">
        <div className="bg-[var(--surface)] rounded-t-3xl border-t border-[var(--border)] pb-[env(safe-area-inset-bottom,0px)]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
          </div>

          {/* Porter avatar + status */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
            <div className="w-9 h-9 rounded-full bg-[var(--forest-green)] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Porter</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {porter.isStreaming ? "Thinking…" : "Your inventory assistant"}
              </p>
            </div>
            <button onClick={onClose} className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Voice capture / response content */}
          {sheetState === "voice" && (voice.state === "listening" || voice.state === "transcribing") && (
            <VoiceOverlay
              state={voiceOverlayState}
              transcript={voice.transcript ?? undefined}
              onCancel={handleVoiceCancel}
              onSend={handleVoiceSend}
            />
          )}

          {sheetState === "response" && lastAssistantMessage && (
            <div className="px-4 py-4 max-h-64 overflow-y-auto space-y-3">
              <StreamingMessage
                message={lastAssistantMessage}
                pills={porter.pills}
                audioUrl={porter.audioUrl}
                onPillSelect={(msg) => { porter.sendMessage(msg); }}
              />
              {porter.isStreaming && (
                <StreamingMessage
                  streamingBlocks={porter.streamingBlocks}
                  isStreaming={porter.isStreaming}
                />
              )}
            </div>
          )}

          {sheetState === "response" && porter.pills.length > 0 && !porter.isStreaming && (
            <div className="px-4 pb-2">
              <ActionPills
                pills={porter.pills}
                onSelect={(msg) => { porter.sendMessage(msg); }}
              />
            </div>
          )}

          {/* Input row */}
          {(sheetState === "idle" || sheetState === "response") && (
            <div className="flex items-center gap-2 px-4 py-4">
              <input
                type="text"
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleTextSend()}
                placeholder="Ask Porter…"
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--forest-green)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
              />
              <button
                onClick={handleStartListening}
                disabled={!!token === false}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-green)] text-white hover:opacity-90 flex-shrink-0"
                aria-label="Voice input"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path strokeLinecap="round" d="M19 10a7 7 0 0 1-14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
              <button
                onClick={handleTextSend}
                disabled={!localInput.trim() || porter.isStreaming}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-green)] text-white disabled:opacity-40 flex-shrink-0"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
