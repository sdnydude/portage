"use client";

import { useRef, useEffect, useMemo } from "react";
import { messageKeys } from "@/lib/porter-keys";
import { StreamingMessage } from "./streaming-message";
import { ActionPills } from "./action-pills";
import type { RichMessage, ActionPill } from "@portage/shared";
import type { StreamingBlock } from "@/hooks/use-porter-stream";

interface FullChatProps {
  messages: RichMessage[];
  streamingBlocks: StreamingBlock[];
  isStreaming: boolean;
  pills: ActionPill[];
  error: string | null;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSend: () => void;
  onPillSelect: (message: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function FullChat({
  messages,
  streamingBlocks,
  isStreaming,
  pills,
  error,
  chatInput,
  onChatInputChange,
  onSend,
  onPillSelect,
  onNewChat,
  onClose,
}: FullChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingBlocks]);
  const keys = useMemo(() => messageKeys(messages), [messages]);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[var(--background)] animate-slide-up-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Close full chat"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
            <path strokeLinecap="round" d="M15 10H5m5-5L5 10l5 5" />
          </svg>
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--forest-green)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-[var(--text-primary)]">Porter</span>
        </div>
        <button
          onClick={onNewChat}
          className="text-sm text-[var(--forest-green)] font-medium hover:opacity-80 transition-opacity"
        >
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--forest-green-50)] flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" className="h-8 w-8">
                <path strokeLinecap="round" d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                <path strokeLinecap="round" d="M19 10a7 7 0 0 1-14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">Ask Porter anything about your inventory</p>
          </div>
        )}
        {messages.map((msg) => (
          <StreamingMessage
            key={keys.get(msg)}
            message={msg}
            pills={msg === messages[messages.length - 1] ? pills : []}
            onPillSelect={onPillSelect}
          />
        ))}
        {isStreaming && (
          <StreamingMessage
            streamingBlocks={streamingBlocks}
            isStreaming={isStreaming}
          />
        )}
      </div>

      {/* Action pills */}
      {pills.length > 0 && !isStreaming && (
        <div className="px-4 pb-2">
          <ActionPills pills={pills} onSelect={onPillSelect} />
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-[env(safe-area-inset-bottom,0px)] border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 py-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            placeholder="Ask Porter…"
            autoFocus
            className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--forest-green)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
          />
          <button
            onClick={onSend}
            disabled={!chatInput.trim() || isStreaming}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-green)] text-white disabled:opacity-40 flex-shrink-0"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        {error && <p className="pb-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
