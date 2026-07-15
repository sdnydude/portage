import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useUnreadCount } from "./use-unread-count";

vi.mock("next/navigation", () => ({ usePathname: () => "/inventory" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t1" }) }));
vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => ({ count: 4 })),
  ApiError: class ApiError extends Error {},
}));

import { api } from "@/lib/api";

function Badge({ id }: { id: string }) {
  const { count } = useUnreadCount();
  return <span data-testid={id}>{count}</span>;
}

describe("useUnreadCount", () => {
  beforeEach(() => {
    vi.mocked(api).mockClear();
  });

  it("fetches the unread count without a provider (standalone fallback)", async () => {
    render(<Badge id="solo" />);
    await waitFor(() => expect(screen.getByTestId("solo")).toHaveTextContent("4"));
    expect(api).toHaveBeenCalledWith("/messages/unread-count", { token: "t1" });
  });

  it("dedupes to a single fetch when multiple consumers mount under UnreadCountProvider", async () => {
    const { UnreadCountProvider } = await import("./use-unread-count");
    render(
      <UnreadCountProvider>
        <Badge id="a" />
        <Badge id="b" />
        <Badge id="c" />
      </UnreadCountProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("4"));
    expect(screen.getByTestId("b")).toHaveTextContent("4");
    expect(screen.getByTestId("c")).toHaveTextContent("4");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("refetch from one consumer updates every consumer under the provider", async () => {
    const { UnreadCountProvider } = await import("./use-unread-count");
    function RefetchButton() {
      const { refetch } = useUnreadCount();
      return <button onClick={() => refetch()}>refresh</button>;
    }
    render(
      <UnreadCountProvider>
        <Badge id="a" />
        <Badge id="b" />
        <RefetchButton />
      </UnreadCountProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("4"));
    vi.mocked(api).mockResolvedValueOnce({ count: 7 });
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("7"));
    expect(screen.getByTestId("b")).toHaveTextContent("7");
  });
});
