import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConversationPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ conversationKey: "buyer1:item1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/messages/buyer1:item1",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t", user: { email: "s@x.com" } }),
}));

vi.mock("@/hooks/use-messages", () => ({
  useConversationMessages: () => ({ messages: [], isLoading: false, error: null, refetch: vi.fn() }),
  useReply: () => ({ sendReply: vi.fn(), isSending: false, error: null }),
  useUnreadCount: () => ({ count: 0 }),
}));

describe("ConversationPage — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<ConversationPage />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
