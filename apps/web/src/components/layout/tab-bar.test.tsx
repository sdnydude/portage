import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabBar } from "./tab-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
}));

vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));

vi.mock("@/components/porter/floating-mic", () => ({
  FloatingMic: () => null,
}));

// Stub ScanFlow: a close button that reports a draft-fallback warning,
// the way Save & List does when eBay rejects the publish.
vi.mock("@/components/capture/scan-flow", () => ({
  ScanFlow: ({ onClose }: { onClose: (r?: { warning?: string }) => void }) => (
    <button onClick={() => onClose({ warning: "Listing created as draft — publish to eBay failed: account locked" })}>
      close-scan-with-warning
    </button>
  ),
}));

describe("TabBar scan warning toast", () => {
  it("surfaces the Save & List draft-fallback warning after ScanFlow closes", async () => {
    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: "Scan item" }));
    fireEvent.click(screen.getByText("close-scan-with-warning"));

    expect(await screen.findByRole("status")).toHaveTextContent(/account locked/);
  });
});
