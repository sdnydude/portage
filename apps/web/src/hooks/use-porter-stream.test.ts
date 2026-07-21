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
