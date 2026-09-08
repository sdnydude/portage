import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t", user: { email: "s@x.com" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }), usePathname: () => "/settings/help" }));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args), ApiError: class extends Error {} }));

import HelpPage from "./page";

beforeEach(() => apiMock.mockReset());

describe("HelpPage — header cluster", () => {
  it("carries the theme toggle and user menu", async () => {
    apiMock.mockResolvedValue({ faqs: [] });
    await act(async () => {
      render(<HelpPage />);
    });
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("HelpPage — FAQs from the API", () => {
  it("renders FAQs fetched from GET /faqs instead of a hardcoded list", async () => {
    apiMock.mockResolvedValue({
      faqs: [
        { id: "f1", question: "Which marketplaces does Portage support?", answer: "eBay and Reverb.", sortOrder: 0, published: true },
      ],
    });

    await act(async () => {
      render(<HelpPage />);
    });

    expect(apiMock).toHaveBeenCalledWith("/faqs", expect.objectContaining({ token: "t" }));
    expect(await screen.findByText("Which marketplaces does Portage support?")).toBeInTheDocument();
    // Old hardcoded entry text must be gone unless served by the API.
    expect(screen.queryByText("How do I scan an item?")).toBeNull();
  });
});
