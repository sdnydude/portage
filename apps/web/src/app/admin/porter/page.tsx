"use client";

import { useAdminApi } from "@/hooks/use-admin";

interface PorterStats {
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
}

interface ConversationSummary {
  id: string;
  userId: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPorterPage() {
  const { data: stats } = useAdminApi<PorterStats>("/porter/stats");
  const { data: convos, isLoading } = useAdminApi<{ conversations: ConversationSummary[]; total: number }>("/conversations?limit=50");

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-text-primary font-[family-name:var(--font-instrument)]">Porter AI</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface rounded-xl border border-border p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider">Conversations</div>
            <div className="text-2xl font-bold text-text-primary mt-1">{stats.totalConversations}</div>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider">Total Messages</div>
            <div className="text-2xl font-bold text-text-primary mt-1">{stats.totalMessages}</div>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider">Avg per Convo</div>
            <div className="text-2xl font-bold text-text-primary mt-1">{stats.avgMessagesPerConversation}</div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-48" /></div>
            ))
          ) : convos?.conversations.length ? (
            convos.conversations.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50">
                <div>
                  <div className="text-sm text-text-primary font-mono text-xs">{c.userId.slice(0, 8)}...</div>
                  <div className="text-xs text-text-placeholder">{c.messageCount} messages</div>
                </div>
                <div className="text-xs text-text-secondary">{new Date(c.updatedAt).toLocaleString()}</div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-text-placeholder">No conversations yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
