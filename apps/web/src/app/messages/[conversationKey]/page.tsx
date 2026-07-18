"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConversationMessages, useReply } from "@/hooks/use-messages";
import { useAuth } from "@/hooks/use-auth";

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const conversationKey = decodeURIComponent(params.conversationKey as string);
  const { messages, isLoading, error, refetch } = useConversationMessages(conversationKey);
  const { sendReply, isSending, error: replyError } = useReply(conversationKey);
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const parts = conversationKey.split(":");
  const buyerUsername = parts[0] ?? "Buyer";
  const itemTitle = messages.length > 0 ? messages[0].itemTitle : null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/messages");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-dvh bg-background items-center justify-center">
        <p className="text-text-secondary text-sm">Log in to view messages.</p>
      </div>
    );
  }

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text || isSending) return;
    try {
      await sendReply(text);
      setReplyText("");
      await refetch();
    } catch {
      // Error shown by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={handleBack} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold font-[family-name:var(--font-instrument)] text-text-primary truncate">
              {buyerUsername}
            </h1>
            {itemTitle && (
              <p className="text-xs text-text-secondary truncate">{itemTitle}</p>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-4 text-sm text-accent-error">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-text-secondary">No messages in this conversation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] ${isOutbound ? "order-1" : ""}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isOutbound
                          ? "bg-forest-green text-white rounded-br-md"
                          : "bg-surface border border-border text-text-primary rounded-bl-md"
                      }`}
                      style={!isOutbound ? { boxShadow: "var(--shadow-subtle)" } : undefined}
                    >
                      {msg.subject && msg.subject !== msg.body && (
                        <p className={`text-xs font-semibold mb-1 ${isOutbound ? "text-white/80" : "text-text-secondary"}`}>
                          {msg.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    </div>
                    <p className={`text-[10px] text-text-placeholder mt-1 ${isOutbound ? "text-right" : "text-left"}`}>
                      {formatTime(msg.ebayCreatedAt as unknown as string)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom padding clears the floating compact tab bar (48px + 8px lift)
          below lg; desktop has no bar, so lg resets to the safe-area rule. */}
      <div
        className="flex-shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(3.75rem+var(--safe-area-bottom))] lg:pb-[max(12px,env(safe-area-inset-bottom))]"
      >
        {replyError && (
          <div className="rounded-xl border border-accent-error bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-accent-error mb-2 max-w-lg mx-auto">
            {replyError}
          </div>
        )}
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={inputRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || isSending}
            className="p-2.5 rounded-full bg-forest-green text-white disabled:opacity-40 transition-opacity flex-shrink-0"
            aria-label="Send reply"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
