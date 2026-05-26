"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "./use-auth";
import type {
  StreamEvent,
  RichMessage,
  ActionPill,
  ContentBlock,
  TextBlock,
} from "@portage/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface StreamingBlock {
  type: "text" | "tool" | "audio";
  text?: string;
  toolId?: string;
  toolName?: string;
  toolStatus?: "running" | "complete";
  audioUrl?: string;
}

export interface PorterStreamState {
  messages: RichMessage[];
  isStreaming: boolean;
  streamingBlocks: StreamingBlock[];
  pills: ActionPill[];
  audioUrl: string | null;
  error: string | null;
  conversationId: string | null;
  sendMessage: (message: string) => Promise<void>;
  startNewChat: () => void;
}

export function usePorterStream(): PorterStreamState {
  const { token } = useAuth();
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingBlocks, setStreamingBlocks] = useState<StreamingBlock[]>([]);
  const [pills, setPills] = useState<ActionPill[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Accumulate streaming blocks without triggering a re-render per chunk
  const streamingRef = useRef<StreamingBlock[]>([]);

  const sendMessage = useCallback(async (message: string) => {
    if (!token || isStreaming) return;

    const userMessage: RichMessage = {
      role: "user",
      blocks: [{ type: "text", text: message } as TextBlock],
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingBlocks([]);
    setPills([]);
    setAudioUrl(null);
    setError(null);
    streamingRef.current = [];

    let finalConvId = conversationId;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const res = await fetch(`${API_BASE}/porter/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, conversationId }),
      });

      if (!res.ok || !res.body) {
        setError("Failed to connect to Porter");
        setIsStreaming(false);
        return;
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(raw) as StreamEvent;
          } catch {
            continue;
          }

          handleEvent(event);
        }
      }
    } catch {
      reader?.cancel().catch(() => {});
      setError("Connection error");
    } finally {
      // Commit accumulated streaming blocks as a finished assistant message
      const finalBlocks: ContentBlock[] = streamingRef.current
        .filter((b) => b.type === "text" && b.text)
        .map((b) => ({ type: "text", text: b.text! } as TextBlock));

      if (finalBlocks.length > 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", blocks: finalBlocks },
        ]);
      }

      setStreamingBlocks([]);
      streamingRef.current = [];
      setIsStreaming(false);
      if (finalConvId !== conversationId) setConversationId(finalConvId);
    }

    function handleEvent(event: StreamEvent) {
      if (event.type === "text_delta") {
        const last = streamingRef.current[streamingRef.current.length - 1];
        if (last?.type === "text") {
          last.text = (last.text ?? "") + event.text;
        } else {
          streamingRef.current.push({ type: "text", text: event.text });
        }
        setStreamingBlocks([...streamingRef.current]);
      } else if (event.type === "tool_start") {
        streamingRef.current.push({
          type: "tool",
          toolId: event.toolId,
          toolName: event.toolName,
          toolStatus: "running",
        });
        setStreamingBlocks([...streamingRef.current]);
      } else if (event.type === "tool_result") {
        const block = streamingRef.current.find(
          (b) => b.type === "tool" && b.toolId === event.toolId
        );
        if (block) block.toolStatus = "complete";
        setStreamingBlocks([...streamingRef.current]);
      } else if (event.type === "action_pills") {
        setPills(event.pills);
      } else if (event.type === "audio_url") {
        setAudioUrl(event.url);
      } else if (event.type === "done") {
        finalConvId = event.conversationId;
        setConversationId(event.conversationId);
      } else if (event.type === "error") {
        setError(event.message);
      }
    }
  }, [token, isStreaming, conversationId]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setPills([]);
    setAudioUrl(null);
    setError(null);
    setStreamingBlocks([]);
    streamingRef.current = [];
  }, []);

  return {
    messages,
    isStreaming,
    streamingBlocks,
    pills,
    audioUrl,
    error,
    conversationId,
    sendMessage,
    startNewChat,
  };
}
