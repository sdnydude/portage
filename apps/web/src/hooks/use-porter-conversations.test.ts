import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => apiMock(...a),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { usePorterConversations } from "./use-porter-conversations";

beforeEach(() => apiMock.mockReset());

describe("usePorterConversations", () => {
  it("loads the conversation list with previews", async () => {
    apiMock.mockResolvedValue({
      conversations: [{ id: "1", preview: "How do I price my camera?", updatedAt: "2026-07-20" }],
    });

    const { result } = renderHook(() => usePorterConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].preview).toBe("How do I price my camera?");
    expect(apiMock).toHaveBeenCalledWith(
      "/porter/conversations",
      expect.objectContaining({ token: "t" }),
    );
  });
});
