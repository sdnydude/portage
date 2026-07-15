"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { EbayConversation, EbayMessage } from "@portage/shared";

interface ConversationsResponse {
  conversations: EbayConversation[];
}

interface MessagesResponse {
  messages: EbayMessage[];
}

export function useConversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<EbayConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<ConversationsResponse>("/messages", { token });
      setConversations(data.conversations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { conversations, isLoading, error, refetch: load };
}

export function useConversationMessages(conversationKey: string) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<EbayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !conversationKey) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<MessagesResponse>(`/messages/${encodeURIComponent(conversationKey)}`, { token });
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [token, conversationKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { messages, isLoading, error, refetch: load };
}

export function useReply(conversationKey: string) {
  const { token } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReply = useCallback(async (body: string) => {
    if (!token) return;
    setIsSending(true);
    setError(null);
    try {
      await api(`/messages/${encodeURIComponent(conversationKey)}/reply`, {
        method: "POST",
        body: { body },
        token,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send reply");
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [token, conversationKey]);

  return { sendReply, isSending, error };
}

export function useSync() {
  const { token } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!token) return;
    setIsSyncing(true);
    setError(null);
    try {
      const data = await api<{ synced: number; total: number }>("/messages/sync", {
        method: "POST",
        token,
      });
      return data;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sync messages");
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [token]);

  return { sync, isSyncing, error };
}

// Moved to its own module (needs JSX for UnreadCountProvider); re-exported
// here so existing imports and test mocks keep working.
export { useUnreadCount } from "./use-unread-count";
