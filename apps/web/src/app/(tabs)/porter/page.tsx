"use client";

import { useRef, useEffect } from "react";
import { usePorter } from "@/hooks/use-porter-context";
import { StreamingMessage } from "@/components/porter/streaming-message";
import { ActionPills } from "@/components/porter/action-pills";

/**
 * Porter tab — the AI assistant's expanded, full-page view. Unlike the inline
 * Porter card on /home (which expands to a fixed FullChat overlay), this is a
 * real tab destination: it lives inside the (tabs) layout so the bottom nav
 * stays visible. Reuses the same Porter primitives (usePorter context,
 * StreamingMessage, ActionPills). DHG palette: Deep Teal = the AI
 * accent, Orange = the send CTA.
 */
export default function PorterPage() {
  const porter = usePorter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [porter.messages, porter.streamingBlocks]);

  const handleSend = () => {
    const text = porter.chatInput.trim();
    if (!text || porter.isStreaming) return;
    porter.setChatInput("");
    porter.sendMessage(text);
  };

  return (
    // (tabs) <main> has pb-20 (5rem) clearance for the fixed tab bar; height:100%
    // doesn't resolve against the flex parent, so pin to the viewport minus that.
    <div className="flex flex-col h-[calc(100dvh-var(--tab-bar-height))]">
      {/* Header — teal AI identity */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 glass-nav glass-fallback border-b border-[var(--border)]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "radial-gradient(circle at 35% 28%, var(--teal-bright), var(--orb-core))" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
              <path d="M12 3l1.7 5L19 9.7l-5.3 1.6L12 17l-1.7-5.7L5 9.7 10.3 8z" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="font-[family-name:var(--font-instrument)] font-semibold text-[var(--text-primary)]">Porter</p>
            <p className="text-[11px] font-medium text-[var(--teal)]">AI inventory assistant</p>
          </div>
        </div>
        <button
          onClick={porter.startNewChat}
          className="text-sm font-semibold text-[var(--teal)] hover:opacity-80 transition-opacity rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
        >
          New chat
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {porter.messages.length === 0 && !porter.isStreaming && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "color-mix(in srgb, var(--teal) 12%, transparent)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                <path d="M12 3l1.7 5L19 9.7l-5.3 1.6L12 17l-1.7-5.7L5 9.7 10.3 8z" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-instrument)] font-semibold text-[var(--text-primary)] mb-1">Ask Porter anything</p>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs">
              Inventory, pricing, comps, listings, orders — Porter knows your shop.
            </p>
          </div>
        )}

        {porter.messages.map((msg, i) => (
          <StreamingMessage
            key={i}
            message={msg}
            pills={i === porter.messages.length - 1 ? porter.pills : []}
            onPillSelect={(message) => porter.sendMessage(message)}
          />
        ))}

        {porter.isStreaming && (
          <StreamingMessage streamingBlocks={porter.streamingBlocks} isStreaming={porter.isStreaming} />
        )}
      </div>

      {/* Suggestion pills (teal-tinted via local --forest-green override) */}
      {porter.pills.length > 0 && !porter.isStreaming && porter.messages.length === 0 && (
        <div className="px-4 pb-2 [--forest-green:var(--teal)]">
          <ActionPills pills={porter.pills} onSelect={(message) => porter.sendMessage(message)} />
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pt-2 pb-3 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={porter.chatInput}
            onChange={(e) => porter.setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask Porter…"
            className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--teal)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
          />
          <button
            onClick={handleSend}
            disabled={!porter.chatInput.trim() || porter.isStreaming}
            aria-label="Send message"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--orange)] text-white disabled:opacity-40 flex-shrink-0 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-[var(--surface)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        {porter.error && <p className="pt-2 text-xs text-[var(--accent-error)]">{porter.error}</p>}
      </div>
    </div>
  );
}
