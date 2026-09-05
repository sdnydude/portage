import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => apiMock(...a),
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { usePorterStream } from "./use-porter-stream";

beforeEach(() => apiMock.mockReset());

describe("usePorterStream streaming block ids", () => {
  it("assigns each streamed block a per-stream id (React key) that restarts on a new stream", async () => {
    // Hand-driven SSE body: push events, inspect the hook mid-stream, then close.
    const openStream = () => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
      const push = (e: object) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
      return { response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }), push, close: () => controller.close() };
    };
    const s1 = openStream();
    const s2 = openStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(s1.response).mockResolvedValueOnce(s2.response));
    const { result } = renderHook(() => usePorterStream());

    let p1!: Promise<void>;
    await act(async () => { p1 = result.current.sendMessage("one"); await Promise.resolve(); });
    await act(async () => {
      s1.push({ type: "text_delta", text: "a" });
      s1.push({ type: "tool_start", toolId: "t1", toolName: "search_inventory" });
      s1.push({ type: "text_delta", text: "b" });
      await new Promise((r) => setTimeout(r, 20));
    });
    const firstIds = result.current.streamingBlocks.map((b) => b.id);
    await act(async () => { s1.push({ type: "done", conversationId: "c1", model: "m", usage: { inputTokens: 0, outputTokens: 0 } }); s1.close(); await p1; });

    let p2!: Promise<void>;
    await act(async () => { p2 = result.current.sendMessage("two"); await Promise.resolve(); });
    await act(async () => { s2.push({ type: "text_delta", text: "c" }); await new Promise((r) => setTimeout(r, 20)); });
    const secondIds = result.current.streamingBlocks.map((b) => b.id);
    await act(async () => { s2.push({ type: "done", conversationId: "c1", model: "m", usage: { inputTokens: 0, outputTokens: 0 } }); s2.close(); await p2; });
    vi.unstubAllGlobals();

    expect(firstIds).toEqual([0, 1, 2]);
    expect(secondIds).toEqual([0]);
  });
});

describe("usePorterStream loadConversation", () => {
  it("rehydrates messages and conversationId from a past conversation", async () => {
    apiMock.mockResolvedValue({
      id: "c1",
      messages: [{ role: "user", blocks: [{ type: "text", text: "hi" }] }],
    });

    const { result } = renderHook(() => usePorterStream());

    await act(async () => {
      await result.current.loadConversation("c1");
    });

    expect(result.current.conversationId).toBe("c1");
    expect(result.current.messages).toHaveLength(1);
    expect(apiMock).toHaveBeenCalledWith(
      "/porter/conversations/c1",
      expect.objectContaining({ token: "t" }),
    );
  });
});
