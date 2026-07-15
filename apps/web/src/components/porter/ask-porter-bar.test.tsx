import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AskPorterBar } from "./ask-porter-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
  useRouter: () => ({ push }),
}));

describe("AskPorterBar", () => {
  it("renders a collapsed one-row Ask Porter input", () => {
    render(<AskPorterBar />);
    const input = screen.getByRole("textbox", { name: "Ask Porter" });
    expect(input).toHaveAttribute("rows", "1");
  });

  it("expands to 3 rows on focus and shows inventory pills", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<AskPorterBar />);
    await user.click(screen.getByRole("textbox", { name: "Ask Porter" }));
    expect(screen.getByRole("textbox", { name: "Ask Porter" })).toHaveAttribute("rows", "3");
    expect(screen.getByRole("button", { name: "What's unlisted?" })).toBeInTheDocument();
  });

  it("Enter submits to /porter?q=…", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<AskPorterBar />);
    await user.type(screen.getByRole("textbox", { name: "Ask Porter" }), "what sold today{Enter}");
    expect(push).toHaveBeenCalledWith("/porter?q=what%20sold%20today");
  });

  it("whitespace-only submit does not navigate", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    push.mockClear();
    render(<AskPorterBar />);
    await user.type(screen.getByRole("textbox", { name: "Ask Porter" }), "   {Enter}");
    expect(push).not.toHaveBeenCalled();
  });

  it("pill click submits the pill text", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    push.mockClear();
    render(<AskPorterBar />);
    await user.click(screen.getByRole("textbox", { name: "Ask Porter" }));
    await user.click(screen.getByRole("button", { name: "What's unlisted?" }));
    expect(push).toHaveBeenCalledWith(`/porter?q=${encodeURIComponent("What's unlisted?")}`);
  });
});
