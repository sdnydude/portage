"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOnboarding } from "@/hooks/use-onboarding";
import { usePorter } from "@/hooks/use-porter-context";
import { StreamingMessage } from "@/components/porter/streaming-message";
import { ActionPills } from "@/components/porter/action-pills";
import { FullChat } from "@/components/porter/full-chat";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { CompsSearchSheet } from "@/components/comps-search-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    const k = (value / 1000).toFixed(1).replace(/\.0$/, "");
    return `$${k}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getProactiveMessage(data: {
  pendingShipments: { id: string }[];
  stats: { activeListings: number };
  portfolio: { totalItems: number };
}): string {
  if (data.pendingShipments.length > 0) {
    const n = data.pendingShipments.length;
    return `You have ${n} order${n !== 1 ? "s" : ""} ready to ship. Want help with them?`;
  }
  if (data.portfolio.totalItems === 0) {
    return "Ready to help you list your first item. Snap a photo and I'll identify it.";
  }
  if (data.stats.activeListings === 0) {
    return `You have ${data.portfolio.totalItems} item${data.portfolio.totalItems !== 1 ? "s" : ""} scanned but nothing listed. Want to start?`;
  }
  return "Ask me anything about your inventory, pricing, or orders.";
}

type ListingFilter = "all" | "active" | "draft" | "sold";

const FILTER_LABELS: { key: ListingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "sold", label: "Sold" },
];

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  active: { bg: "#0F9D58", label: "Active" }, // was absent → active listings showed no badge
  sold: { bg: "#0B6B3E", label: "Sold" },
  draft: { bg: "#F77E2D", label: "Draft" },
  archived: { bg: "#8A857C", label: "Archived" },
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useDashboard();
  const { shouldShowOnboarding, completeOnboarding, isCompleting } = useOnboarding();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCompsOpen, setIsCompsOpen] = useState(false);
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const porter = usePorter();
  const { chatInput, setChatInput, isEngaged, setIsEngaged } = porter;

  // Scroll only the chat container, not the page
  useEffect(() => {
    if (isEngaged && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [porter.messages, porter.streamingBlocks, isEngaged]);

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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-2 text-2xl">
            Welcome to Portage
          </h1>
          <p className="text-text-secondary mb-6 max-w-xs text-sm">
            AI-powered inventory and marketplace selling. Scan, list, and sell your items in seconds.
          </p>
          <Link href="/" className="px-8 py-3 rounded-full bg-forest-green text-white font-semibold text-sm">
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredListings =
    listingFilter === "all"
      ? data.recentListings
      : data.recentListings.filter((l) => l.status === listingFilter);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">

      {/* ─── Porter hero ─── */}
      <div
        className="animate-rise relative -mx-4 px-4 pb-7 rounded-b-[32px] overflow-hidden"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 18px)",
          background:
            "radial-gradient(125% 95% at 80% -12%, rgba(63,192,196,0.38), transparent 58%), radial-gradient(80% 65% at 8% 6%, rgba(17,154,160,0.16), transparent 60%), linear-gradient(162deg, var(--hero-top) 0%, var(--hero-bottom) 100%)",
          boxShadow: "0 20px 44px -30px rgba(6,18,20,0.85)",
        }}
      >
        {/* teal AI aurora */}
        <div
          aria-hidden
          className="porter-aurora pointer-events-none absolute -top-20 -right-12 w-72 h-72 rounded-full blur-3xl opacity-50"
          style={{ background: "conic-gradient(from 200deg, rgba(63,192,196,0.6), rgba(17,154,160,0.4), rgba(110,210,215,0.5), rgba(63,192,196,0.6))" }}
        />

        {/* Header row: greeting + actions */}
        <div className="relative flex items-center gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--on-forest-mute)]">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--teal-bright)]"
                style={{ boxShadow: "0 0 6px 1px rgba(63,192,196,0.8)" }}
              />
              {getGreeting()}
            </p>
            <p className="font-[family-name:var(--font-instrument)] italic font-medium text-[32px] leading-[1.1] -tracking-[0.01em] text-[var(--orange-bright)] mt-0.5">
              {data.displayName}
            </p>
          </div>

          {isEngaged && (
            <button
              onClick={() => setIsFullScreen(true)}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-[var(--on-forest-mute)] hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bottom)]"
              aria-label="Expand to full chat"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" d="M10 2h4v4M6 14H2v-4M14 6l-5 5M2 10l5-5" />
              </svg>
            </button>
          )}

          <ThemeToggle className="flex-shrink-0 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-[var(--on-forest-mute)] hover:bg-white/20 transition-colors" />

          <Link
            href="/more"
            className="flex-shrink-0 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-[var(--on-forest-mute)] hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bottom)]"
            aria-label="Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>

        {/* Chat area */}
        {!isEngaged ? (
          /* Idle Porter card — prominent circular orb + PORTER·READY label + prompt */
          <div
            className="glass-control relative flex items-start gap-3 rounded-2xl p-4 mb-4"
            style={{ border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <div
              className="relative flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "radial-gradient(circle at 35% 28%, var(--teal-bright), var(--orb-core))" }}
            >
              <span className="porter-orb-ring absolute inset-0 rounded-full" style={{ border: "1.5px solid var(--teal-bright)" }} />
              <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                <path d="M12 3l1.7 5L19 9.7l-5.3 1.6L12 17l-1.7-5.7L5 9.7 10.3 8z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-jetbrains)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--on-forest-mute)] mb-1">
                Porter · Ready
              </p>
              <p className="text-sm leading-snug text-[var(--on-forest)]">
                {getProactiveMessage(data)}
              </p>
            </div>
          </div>
        ) : (
          /* Active chat messages — opaque elevated surface so it reads on the graphite hero */
          <div
            ref={chatContainerRef}
            className="relative mb-3 overflow-y-auto space-y-3 rounded-2xl p-3.5"
            style={{
              maxHeight: "clamp(240px, 40vh, 400px)",
              background: "var(--surface)",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "var(--shadow-elevated)",
            }}
          >
            {porter.messages.map((msg, i) => (
              <StreamingMessage
                key={i}
                message={msg}
                pills={i === porter.messages.length - 1 ? porter.pills : []}
                onPillSelect={handlePillSelect}
              />
            ))}
            {porter.isStreaming && (
              <StreamingMessage
                key="streaming"
                streamingBlocks={porter.streamingBlocks}
                isStreaming={porter.isStreaming}
              />
            )}
          </div>
        )}

        {/* Action pills — teal-tinted via local --forest-green override */}
        {!isEngaged && (
          <div className="relative mb-3 [--forest-green:var(--teal-bright)]">
            <ActionPills
              pills={[
                ...(data.pendingShipments.length > 0
                  ? [{
                    label: `Ship ${data.pendingShipments.length} order${data.pendingShipments.length !== 1 ? "s" : ""}`,
                    message: `I have ${data.pendingShipments.length} orders to ship`,
                  }]
                  : []),
                { label: "Check values", message: "What are my most valuable items?" },
                { label: "List an item", message: "Help me list something" },
              ]}
              onSelect={handlePillSelect}
            />
          </div>
        )}

        {/* Ask card — glass control; orange send CTA */}
        <div
          className="glass-control relative flex items-center gap-2 rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--teal-bright)]"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask Porter…"
            className="flex-1 bg-transparent text-sm outline-none text-[var(--on-forest)] placeholder:text-[var(--on-forest-mute)] min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim() || porter.isStreaming}
            aria-label="Send message"
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--orange)] text-white disabled:opacity-40 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bottom)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>

        {porter.error && (
          <p className="relative mt-2 text-xs text-[var(--on-forest-error)]" role="alert">
            {porter.error}
          </p>
        )}
      </div>

      {/* ─── Value band — overlaps the hero (sibling + -mt + z-30, not clipped) ─── */}
      <div
        className="animate-rise relative z-30 -mt-6 mb-6 grid grid-cols-[1.4fr_1fr] rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
        style={{ boxShadow: "var(--shadow-elevated)", animationDelay: "0.08s" }}
      >
        <div className="p-4">
          <p className="font-[family-name:var(--font-jetbrains)] text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            Portfolio value
          </p>
          <p className="font-[family-name:var(--font-jetbrains)] font-bold text-[32px] leading-none mt-1.5 tabular-nums text-text-primary">
            <span className="text-[var(--orange-dark)]">$</span>
            {formatCurrency(data.portfolio.totalValueRecommended).slice(1)}
          </p>
        </div>
        <div className="flex flex-col border-l border-[var(--border)]">
          <div className="flex-1 px-4 py-2.5 flex flex-col justify-center">
            <p className="font-[family-name:var(--font-jetbrains)] font-semibold text-lg leading-none tabular-nums text-text-primary">
              {data.stats.activeListings}
            </p>
            <p className="font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-wider text-text-secondary mt-1">Listed</p>
          </div>
          <div className="flex-1 px-4 py-2.5 flex flex-col justify-center border-t border-[var(--border)]">
            <p className="font-[family-name:var(--font-jetbrains)] font-semibold text-lg leading-none tabular-nums text-text-primary">
              {data.portfolio.totalItems}
            </p>
            <p className="font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-wider text-text-secondary mt-1">Items</p>
          </div>
        </div>
      </div>

      {/* ─── eBay Price Check ─── */}
      <button
        onClick={() => setIsCompsOpen(true)}
        className="animate-rise w-full flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 mb-6 text-left hover:bg-[var(--surface-hover,var(--muted))] transition-colors"
        style={{ boxShadow: "var(--shadow-subtle)", animationDelay: "0.16s" }}
      >
        <div className="w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--teal)]">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">eBay Price Check</p>
          <p className="text-xs text-text-secondary mt-0.5">Search sold &amp; active comps</p>
        </div>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-text-placeholder flex-shrink-0">
          <path strokeLinecap="round" d="M6 4l4 4-4 4" />
        </svg>
      </button>

      {/* ─── Listings section ─── */}
      {data.recentListings.length > 0 ? (
        <div className="animate-rise" style={{ animationDelay: "0.24s" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-[family-name:var(--font-instrument)] font-bold -tracking-[0.02em] text-text-primary text-xl">
              Your Listings
            </h2>
            <Link href="/listings" className="flex items-center gap-0.5 text-[var(--teal)] text-sm font-semibold">
              See all
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </Link>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-3">
            {FILTER_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setListingFilter(key)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
                style={{
                  background: listingFilter === key ? "var(--graphite)" : "transparent",
                  color: listingFilter === key ? "white" : "var(--text-secondary)",
                  border: listingFilter === key ? "1.5px solid var(--graphite)" : "1.5px solid var(--border)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Grid: 2-col on mobile, 3-col on sm+ */}
          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden block"
                  style={{ boxShadow: "var(--shadow-subtle)" }}
                >
                  <div className="relative overflow-hidden" style={{ paddingBottom: "100%" }}>
                    {listing.itemPhotoUrl ? (
                      <img
                        src={listing.itemPhotoUrl}
                        alt={listing.itemTitle}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center text-text-placeholder">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                    {STATUS_BADGE[listing.status] && (
                      <span
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-[7px] text-[10px] font-semibold text-white"
                        style={{ background: STATUS_BADGE[listing.status].bg }}
                      >
                        {STATUS_BADGE[listing.status].label}
                      </span>
                    )}
                    {/* Price chip — dark glass overlay, bottom-left (mockup) */}
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-[7px] text-[11px] font-semibold text-white font-[family-name:var(--font-jetbrains)] bg-black/55 backdrop-blur-sm border border-white/10">
                      ${listing.price.toFixed(0)}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-text-primary truncate leading-snug">
                      {listing.itemTitle}
                    </p>
                    {Math.round(listing.confidence * 100) > 0 && (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--teal)] font-[family-name:var(--font-jetbrains)]">
                        {Math.round(listing.confidence * 100)}% match
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-secondary text-sm py-8">
              No {listingFilter === "all" ? "" : listingFilter + " "}listings yet
            </p>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-2xl p-6 border border-[var(--border)] text-center">
          <p className="text-text-secondary text-sm">
            Snap a photo to get started. Porter will identify it and help you list it for sale.
          </p>
        </div>
      )}

      {/* eBay comps search sheet */}
      {isCompsOpen && <CompsSearchSheet onClose={() => setIsCompsOpen(false)} />}

      {/* Onboarding overlay — shown once for new users */}
      {shouldShowOnboarding && (
        <OnboardingFlow
          onComplete={completeOnboarding}
          onSkip={completeOnboarding}
          isCompleting={isCompleting}
        />
      )}

      {/* Full-screen chat overlay */}
      {isFullScreen && (
        <FullChat
          messages={porter.messages}
          streamingBlocks={porter.streamingBlocks}
          isStreaming={porter.isStreaming}
          pills={porter.pills}
          error={porter.error}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSend={handleSend}
          onPillSelect={handlePillSelect}
          onNewChat={() => {
            porter.startNewChat();
            setIsEngaged(false);
            setIsFullScreen(false);
          }}
          onClose={() => setIsFullScreen(false)}
        />
      )}
    </div>
  );
}
