"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOnboarding } from "@/hooks/use-onboarding";
import { usePorterStream } from "@/hooks/use-porter-stream";
import { usePorterAudio } from "@/hooks/use-porter-audio";
import { StreamingMessage } from "@/components/porter/streaming-message";
import { ActionPills } from "@/components/porter/action-pills";
import { VoiceButton } from "@/components/porter/voice-button";
import { FullChat } from "@/components/porter/full-chat";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomePage() {
  const { isAuthenticated, token } = useAuth();
  const { data, isLoading, error } = useDashboard();
  const { shouldShowOnboarding, completeOnboarding, isCompleting } = useOnboarding();
  const [chatInput, setChatInput] = useState("");
  const [isEngaged, setIsEngaged] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const porter = usePorterStream();
  const audio = usePorterAudio();

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [porter.messages, porter.streamingBlocks]);

  // Auto-play TTS when audio URL arrives and autoPlay is on
  useEffect(() => {
    if (porter.audioUrl && audio.autoPlay && token) {
      // audioUrl from stream is a URL — we'd play it directly; speak() is for text
    }
  }, [porter.audioUrl, audio.autoPlay, token]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || porter.isStreaming) return;
    setChatInput("");
    setIsEngaged(true);
    porter.sendMessage(text);
  };

  const handlePillSelect = (message: string) => {
    setIsEngaged(true);
    porter.sendMessage(message);
  };

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--forest-green)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1
            className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-2"
            style={{ fontSize: "var(--text-title)" }}
          >
            Welcome to Portage
          </h1>
          <p className="text-text-secondary mb-6 max-w-xs" style={{ fontSize: "var(--text-body)" }}>
            AI-powered inventory and marketplace selling. Scan, list, and sell your items in seconds.
          </p>
          <Link
            href="/login"
            className="px-8 py-3 rounded-full bg-forest-green text-white font-semibold text-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasItems = data.portfolio.totalItems > 0;
  const hasListings = data.recentListings.length > 0;
  const hasPendingShipments = data.pendingShipments.length > 0;

  return (
    <div className="px-4 pt-safe max-w-lg mx-auto">
      {/* Header with greeting + action icons */}
      <header className="flex items-center justify-between py-4">
        <div>
          <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
            {getGreeting()}
          </p>
          <h1
            className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
            style={{ fontSize: "var(--text-title)" }}
          >
            {data.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-forest-green-50 transition-colors"
            aria-label="Orders"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-secondary"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </Link>
          <Link
            href="/more"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-forest-green-50 transition-colors"
            aria-label="Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-secondary"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Porter Chat Section */}
      <div className={`transition-all duration-300 ${isEngaged ? "mb-4" : "mb-3"}`}>
        {/* Message history — animates open when engaged */}
        <div
          className="overflow-hidden transition-[max-height] duration-300 ease-out"
          style={{ maxHeight: isEngaged ? "400px" : "0px" }}
        >
          <div className="mb-3 overflow-y-auto space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3" style={{ maxHeight: "392px" }}>
            {porter.messages.map((msg, i) => (
              <StreamingMessage
                key={i}
                message={msg}
                pills={i === porter.messages.length - 1 ? porter.pills : []}
                audioUrl={i === porter.messages.length - 1 ? porter.audioUrl : null}
                onPillSelect={handlePillSelect}
              />
            ))}
            {porter.isStreaming && (
              <StreamingMessage
                streamingBlocks={porter.streamingBlocks}
                isStreaming={porter.isStreaming}
              />
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Action pills — default suggestions when idle */}
        {!isEngaged && data && (
          <ActionPills
            pills={[
              ...(data.pendingShipments.length > 0
                ? [{ label: "Ship orders", message: `I have ${data.pendingShipments.length} orders to ship` }]
                : []),
              { label: "Check values", message: "What are my most valuable items?" },
              { label: "List an item", message: "Help me list something" },
            ]}
            onSelect={handlePillSelect}
          />
        )}

        {/* Expand to full-screen button — only visible when engaged */}
        {isEngaged && (
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setIsFullScreen(true)}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--forest-green)] transition-colors"
              aria-label="Expand chat"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" d="M10 2h4v4M6 14H2v-4M14 6l-5 5M2 10l5-5" />
              </svg>
              <span>Expand</span>
            </button>
          </div>
        )}

        {/* Chat input bar */}
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask Porter…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-placeholder)]"
          />
          <VoiceButton onTranscript={(text) => { setChatInput(text); setIsEngaged(true); porter.sendMessage(text); }} />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim() || porter.isStreaming}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--forest-green)] text-white disabled:opacity-40"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        {porter.error && (
          <p className="mt-1 text-xs text-red-500">{porter.error}</p>
        )}
      </div>

      <div className="space-y-4 pb-6">
        {/* Portfolio Value Card — collapses when chat is engaged */}
        {hasItems ? (
          <div
            className={`rounded-2xl border border-forest-green-100 overflow-hidden transition-all duration-300 ${isEngaged ? "max-h-0 opacity-0 p-0" : "p-5 max-h-[200px] opacity-100"}`}
            style={{
              background: "linear-gradient(135deg, var(--forest-green-50), var(--surface))",
              boxShadow: isEngaged ? "none" : "var(--shadow-medium)",
            }}
          >
            <p className="text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>
              Portfolio Value
            </p>
            <p
              className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
              style={{ fontSize: "var(--text-display)" }}
            >
              {formatCurrency(data.portfolio.totalValueRecommended)}
            </p>
            <p className="text-text-secondary mt-1" style={{ fontSize: "var(--text-caption)" }}>
              {formatCurrency(data.portfolio.totalValueLow)} &ndash;{" "}
              {formatCurrency(data.portfolio.totalValueHigh)} range
            </p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Items
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.portfolio.totalItems}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Listed
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.stats.activeListings}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Sold
                </p>
                <p className="font-semibold text-text-primary" style={{ fontSize: "var(--text-headline)" }}>
                  {data.stats.soldListings}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 border border-border text-center"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--forest-green)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <h2
              className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-2"
              style={{ fontSize: "var(--text-headline)" }}
            >
              Add Your First Item
            </h2>
            <p className="text-text-secondary mb-4" style={{ fontSize: "var(--text-body)" }}>
              Snap a photo to get started. Porter will identify it and help you list it for sale.
            </p>
          </div>
        )}

        {/* Pending Shipments — full list when idle, compact badge when engaged */}
        {hasPendingShipments && (
          <div>
            {isEngaged ? (
              <Link
                href="/orders"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.5.5 0 01.5.5v3.793l2.354 2.353a.5.5 0 01-.708.708L7.5 8.707V4.5A.5.5 0 018 4z" />
                </svg>
                <span>{data.pendingShipments.length} order{data.pendingShipments.length !== 1 ? "s" : ""} need shipping</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 ml-auto flex-shrink-0">
                  <path strokeLinecap="round" d="M6 4l4 4-4 4" />
                </svg>
              </Link>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
                    style={{ fontSize: "var(--text-headline)" }}
                  >
                    Needs Shipping
                  </h2>
                  <Link
                    href="/orders"
                    className="text-forest-green font-medium"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    View All
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.pendingShipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border"
                      style={{ boxShadow: "var(--shadow-subtle)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {shipment.itemTitle}
                        </p>
                        <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                          {shipment.buyerUsername} &middot;{" "}
                          {shipment.marketplace === "ebay" ? "eBay" : "Etsy"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-forest-green">
                          {formatCurrency(shipment.salePrice)}
                        </p>
                        <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                          {formatDate(shipment.soldAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Recent Listings — full cards when idle, compact photo rail when engaged */}
        {hasListings && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
                style={{ fontSize: isEngaged ? "var(--text-caption)" : "var(--text-headline)" }}
              >
                {isEngaged ? "Recent Listings" : "Recent Listings"}
              </h2>
              <Link
                href="/listings"
                className="text-forest-green font-medium"
                style={{ fontSize: "var(--text-caption)" }}
              >
                {isEngaged ? "See all →" : "View All"}
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {data.recentListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className={`flex-shrink-0 rounded-xl bg-surface border border-border overflow-hidden transition-all duration-300 ${isEngaged ? "w-16" : "w-36"}`}
                  style={{ boxShadow: "var(--shadow-subtle)" }}
                >
                  <div className="relative overflow-hidden" style={{ paddingBottom: "100%" }}>
                    {listing.itemPhotoUrl ? (
                      <img
                        src={listing.itemPhotoUrl}
                        alt={listing.itemTitle}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center text-text-placeholder">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {!isEngaged && (
                    <div className="p-2">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {listing.itemTitle}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-semibold text-forest-green">
                          {formatCurrency(listing.price)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                            listing.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : listing.status === "sold"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {listing.status === "active"
                            ? "Active"
                            : listing.status === "sold"
                              ? "Sold"
                              : "Draft"}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats — hidden when engaged */}
        {!isEngaged && data.stats.totalOrders > 0 && (
          <div
            className="rounded-2xl p-4 border border-border"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <h2
              className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3"
              style={{ fontSize: "var(--text-headline)" }}
            >
              Sales Summary
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Total Sales
                </p>
                <p className="font-semibold text-text-primary text-lg">
                  {data.stats.totalOrders}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-text-secondary" style={{ fontSize: "var(--text-caption)" }}>
                  Revenue
                </p>
                <p className="font-semibold text-forest-green text-lg">
                  {formatCurrency(data.stats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo FAB */}
      <Link
        href="/list"
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-forest-green text-white shadow-lg flex items-center justify-center hover:bg-forest-green/90 active:scale-95 transition-all"
        style={{ boxShadow: '0 4px 20px rgba(45,90,39,0.3)' }}
        aria-label="List an item"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </Link>

      {/* Onboarding overlay — shown once for new users */}
      {shouldShowOnboarding && (
        <OnboardingFlow
          onComplete={completeOnboarding}
          onSkip={completeOnboarding}
          isCompleting={isCompleting}
        />
      )}

      {/* Full-screen chat overlay — slide-up, preserves conversation state */}
      {isFullScreen && (
        <FullChat
          messages={porter.messages}
          streamingBlocks={porter.streamingBlocks}
          isStreaming={porter.isStreaming}
          pills={porter.pills}
          audioUrl={porter.audioUrl}
          error={porter.error}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSend={handleSend}
          onPillSelect={handlePillSelect}
          onVoiceTranscript={(text) => { setChatInput(text); setIsEngaged(true); porter.sendMessage(text); }}
          onNewChat={() => { porter.startNewChat(); setIsEngaged(false); setIsFullScreen(false); }}
          onClose={() => setIsFullScreen(false)}
        />
      )}
    </div>
  );
}
