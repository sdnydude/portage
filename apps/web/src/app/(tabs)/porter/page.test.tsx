import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PorterPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/porter",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "s@x.com" } }),
}));

vi.mock("@/hooks/use-porter-context", () => ({
  usePorter: () => ({
    messages: [],
    streamingBlocks: [],
    isStreaming: false,
    pills: [],
    error: null,
    chatInput: "",
    setChatInput: vi.fn(),
    sendMessage: vi.fn(),
    startNewChat: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-porter-autosend", () => ({
  usePorterAutosend: () => {},
}));

// jsdom has no scrollTo on elements.
window.HTMLElement.prototype.scrollTo = vi.fn();

describe("PorterPage — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<PorterPage />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
