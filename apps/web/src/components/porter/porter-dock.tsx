"use client";

import { useState } from "react";
import { usePorter } from "@/hooks/use-porter-context";
import { useCurrentItem } from "@/hooks/use-current-item";
import { usePorterConversations } from "@/hooks/use-porter-conversations";
import { StreamingMessage } from "./streaming-message";

/**
 * Porter dock (Phase R3) — a collapsible right rail that puts Porter on every
 * desktop route via the AppShell dock-slot. Reuses the Porter tab primitives
 * (usePorter context + StreamingMessage) and is context-aware of the on-screen
 * item through useCurrentItem. Desktop-only (lg+); mobile keeps the Porter tab.
 */
export function PorterDock() {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const porter = usePorter();
  const { itemId } = useCurrentItem();
  const { conversations } = usePorterConversations();

  const handleSend = () => {
    const text = porter.chatInput.trim();
    if (!text || porter.isStreaming) return;
    porter.setChatInput("");
    porter.sendMessage(text);
  };

  if (!expanded) {
    return (
      <aside
        data-testid="dock-slot"
        className="hidden lg:flex w-12 shrink-0 flex-col items-center border-l border-border pt-3"
      >
        <button
          type="button"
          aria-label="Open Porter"
          onClick={() => setExpanded(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
          style={{
            background:
              "radial-gradient(circle at 35% 28%, var(--teal-bright), var(--orb-core))",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <path d="M12 3l1.7 5L19 9.7l-5.3 1.6L12 17l-1.7-5.7L5 9.7 10.3 8z" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="dock-slot"
      className="hidden lg:flex h-[calc(100dvh-4rem)] w-[360px] shrink-0 flex-col border-l border-border"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-[family-name:var(--font-instrument)] font-semibold text-[var(--text-primary)]">
          Porter
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView(view === "history" ? "chat" : "history")}
            className="text-xs font-semibold text-[var(--teal)]"
          >
            History
          </button>
          <button
            type="button"
            onClick={() => {
              porter.startNewChat();
              setView("chat");
            }}
            className="text-xs font-semibold text-[var(--teal)]"
          >
            New
          </button>
          <button
            type="button"
            aria-label="Collapse Porter"
            onClick={() => setExpanded(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--muted)]"
          >
            ✕
          </button>
        </div>
      </header>

      {view === "history" ? (
        <ul className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--text-secondary)]">
              No past conversations yet.
            </li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    porter.loadConversation(c.id);
                    setView("chat");
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--muted)]"
                >
                  {c.preview || "(empty conversation)"}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <>
          {itemId ? (
            <div
              data-testid="dock-context-chip"
              className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--teal)]"
            >
              Context: viewing this item
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {porter.messages.map((msg, i) => (
              <StreamingMessage
                key={i}
                message={msg}
                pills={i === porter.messages.length - 1 ? porter.pills : []}
                onPillSelect={(message) => porter.sendMessage(message)}
              />
            ))}
            {porter.isStreaming ? (
              <StreamingMessage
                streamingBlocks={porter.streamingBlocks}
                isStreaming={porter.isStreaming}
              />
            ) : null}
          </div>
        </>
      )}

      {view === "chat" ? (
      <div className="border-t border-border bg-[var(--surface)] px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={porter.chatInput}
            onChange={(e) => porter.setChatInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSend()
            }
            placeholder="Ask Porter…"
            className="flex-1 rounded-2xl border border-border bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--teal)]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!porter.chatInput.trim() || porter.isStreaming}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--orange)] text-white disabled:opacity-40"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        {porter.error ? (
          <p className="pt-1 text-xs text-[var(--accent-error)]">
            {porter.error}
          </p>
        ) : null}
      </div>
      ) : null}
    </aside>
  );
}
