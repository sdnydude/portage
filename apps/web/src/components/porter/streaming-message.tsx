"use client";

import type { RichMessage, ActionPill } from "@portage/shared";
import type { StreamingBlock } from "@/hooks/use-porter-stream";
import { ToolBlock } from "./tool-block";
import { ActionPills } from "./action-pills";

interface StreamingMessageProps {
  // Finished message (history)
  message?: RichMessage;
  // In-progress stream blocks
  streamingBlocks?: StreamingBlock[];
  isStreaming?: boolean;
  pills?: ActionPill[];
  audioUrl?: string | null;
  onPillSelect?: (message: string) => void;
}

export function StreamingMessage({
  message,
  streamingBlocks,
  isStreaming,
  pills = [],
  audioUrl,
  onPillSelect,
}: StreamingMessageProps) {
  const isUser = message?.role === "user";

  if (isUser) {
    const text = message.blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--forest-green)] px-4 py-2 text-sm text-white">
          {text}
        </div>
      </div>
    );
  }

  // Finished assistant message
  if (message) {
    const textContent = message.blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    return (
      <div className="flex flex-col gap-2">
        {textContent && (
          <div className="rounded-2xl rounded-bl-sm bg-[var(--surface)] px-4 py-2 text-sm leading-relaxed">
            {textContent}
          </div>
        )}
        {pills.length > 0 && onPillSelect && (
          <ActionPills pills={pills} onSelect={onPillSelect} />
        )}
        {audioUrl && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>🔊</span>
            <audio src={audioUrl} controls className="h-7 w-40" />
          </div>
        )}
      </div>
    );
  }

  // In-progress streaming
  return (
    <div className="flex flex-col gap-2">
      {streamingBlocks?.map((block, i) => {
        if (block.type === "text") {
          return (
            <div key={i} className="rounded-2xl rounded-bl-sm bg-[var(--surface)] px-4 py-2 text-sm leading-relaxed">
              {block.text}
              {isStreaming && i === (streamingBlocks.length - 1) && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
              )}
            </div>
          );
        }
        if (block.type === "tool") {
          return (
            <ToolBlock
              key={i}
              toolId={block.toolId ?? ""}
              toolName={block.toolName ?? ""}
              status={block.toolStatus ?? "running"}
            />
          );
        }
        return null;
      })}
      {!isStreaming && pills.length > 0 && onPillSelect && (
        <ActionPills pills={pills} onSelect={onPillSelect} />
      )}
    </div>
  );
}
