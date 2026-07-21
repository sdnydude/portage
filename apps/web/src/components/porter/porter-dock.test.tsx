import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const porterStub = {
  chatInput: "",
  setChatInput: vi.fn(),
  sendMessage: vi.fn(),
  startNewChat: vi.fn(),
  loadConversation: vi.fn(),
  messages: [],
  streamingBlocks: [],
  isStreaming: false,
  pills: [],
  error: null,
};
let mockCurrentItemId: string | null = null;
vi.mock("@/hooks/use-porter-context", () => ({ usePorter: () => porterStub }));
vi.mock("@/hooks/use-current-item", () => ({
  useCurrentItem: () => ({
    itemId: mockCurrentItemId,
    setCurrentItem: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-porter-conversations", () => ({
  usePorterConversations: () => ({
    conversations: [
      { id: "c1", preview: "Price my camera", updatedAt: "2026-07-20" },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { PorterDock } from "./porter-dock";

describe("PorterDock", () => {
  it("is collapsed by default and expands on click", () => {
    render(<PorterDock />);

    expect(screen.queryByPlaceholderText("Ask Porter…")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /open porter/i }));

    expect(screen.getByPlaceholderText("Ask Porter…")).toBeInTheDocument();
  });

  it("shows a context chip when an item is on screen", () => {
    mockCurrentItemId = "item-42";
    render(<PorterDock />);

    fireEvent.click(screen.getByRole("button", { name: /open porter/i }));

    expect(screen.getByTestId("dock-context-chip")).toBeInTheDocument();
    mockCurrentItemId = null;
  });

  it("shows conversation history and resumes the one clicked", () => {
    render(<PorterDock />);
    fireEvent.click(screen.getByRole("button", { name: /open porter/i }));

    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    const row = screen.getByText("Price my camera");
    expect(row).toBeInTheDocument();

    fireEvent.click(row);
    expect(porterStub.loadConversation).toHaveBeenCalledWith("c1");
  });
});
