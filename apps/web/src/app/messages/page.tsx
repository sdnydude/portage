"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConversations, useSync } from "@/hooks/use-messages";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(str: string | null | undefined, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export default function MessagesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { conversations, isLoading, error, refetch } = useConversations();
  const { sync, isSyncing, error: syncError } = useSync();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/more");
    }
  };

  const handleSync = async () => {
    try {
      await sync();
      await refetch();
    } catch {
      // Error displayed via sync hook
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Messages" />
        <div className="px-4 py-6 content-container">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-secondary text-sm">Log in to view your messages.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 content-container">
          <button onClick={handleBack} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary flex-1">Messages</h1>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Sync messages"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? "animate-spin" : ""}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
        </div>
      </header>

      <div className="px-4 py-4 content-container">
        {syncError && (
          <div className="rounded-2xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-4 text-sm text-accent-error mb-4">
            Sync failed: {syncError}
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-4 text-sm text-accent-error">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-text-primary mb-1">No messages yet</h2>
            <p className="text-sm text-text-secondary max-w-[240px]">
              Tap the refresh button to sync messages from your eBay account.
            </p>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="mt-4 px-4 py-2 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {isSyncing ? "Syncing…" : "Sync from eBay"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link
                key={conv.conversationKey}
                href={`/messages/${encodeURIComponent(conv.conversationKey)}`}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-surface transition-colors hover:bg-muted"
                style={{ boxShadow: "var(--shadow-subtle)" }}
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {conv.buyerUsername.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${conv.unreadCount > 0 ? "font-bold text-text-primary" : "font-medium text-text-primary"}`}>
                      {conv.buyerUsername}
                    </span>
                    <span className="text-xs text-text-placeholder flex-shrink-0">
                      {formatRelativeTime(conv.lastMessageAt as unknown as string)}
                    </span>
                  </div>
                  {conv.itemTitle && (
                    <p className="text-xs text-text-secondary truncate mt-0.5">{conv.itemTitle}</p>
                  )}
                  <p className={`text-xs mt-0.5 truncate ${conv.unreadCount > 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                    {truncate(conv.lastMessageBody, 80)}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <div
                    className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center flex-shrink-0 mt-1"
                    aria-label={`${conv.unreadCount} unread message${conv.unreadCount === 1 ? "" : "s"}`}
                    role="status"
                  >
                    <span className="text-[10px] font-bold text-white" aria-hidden="true">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
