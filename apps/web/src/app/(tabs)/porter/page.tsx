"use client";

import { useState, useRef, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PorterPage() {
  const { token, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !token || isLoading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const data = await api<{ conversationId: string; message: string }>("/porter/message", {
        method: "POST",
        body: { message: text, conversationId },
        token,
      });

      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="w-8 h-8 rounded-full bg-forest-green flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Porter</h1>
              <p className="text-xs text-text-secondary">AI Assistant</p>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-text-secondary">Sign in to chat with Porter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="w-8 h-8 rounded-full bg-forest-green flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Porter</h1>
            <p className="text-xs text-text-secondary">
              {isLoading ? "Thinking..." : "AI Assistant"}
            </p>
          </div>
          {conversationId && (
            <button
              onClick={() => {
                setMessages([]);
                setConversationId(null);
              }}
              className="ml-auto px-3 py-1 rounded-lg text-xs text-text-secondary hover:text-text-primary"
            >
              New Chat
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-forest-green flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.2 4.7 3 6.3V21l3.5-2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
                <circle cx="8" cy="10.5" r="1" fill="#2D5A27" />
                <circle cx="12" cy="10.5" r="1" fill="#2D5A27" />
                <circle cx="16" cy="10.5" r="1" fill="#2D5A27" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
              Hey, I&apos;m Porter
            </h2>
            <p className="text-sm text-text-secondary max-w-xs mb-4">
              I can help you manage inventory, write listings, estimate values, and optimize your selling strategy.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["What's my inventory worth?", "Help me list an item", "Show my top items"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 rounded-full bg-muted text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-forest-green text-white rounded-br-md"
                    : "bg-muted text-text-primary rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-text-placeholder animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-text-placeholder animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-text-placeholder animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3 pb-safe">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Porter anything..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-forest-green text-white flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
