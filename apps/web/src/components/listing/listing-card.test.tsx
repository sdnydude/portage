import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiMock = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: (...args: unknown[]) => apiMock(...args),
}));
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ListingCard } from "./listing-card";
import { ApiError } from "@/lib/api";

beforeEach(() => {
  apiMock.mockReset();
  pushMock.mockReset();
  // Default routing: every card with an active eBay listing fetches
  // /seller-profile (GTC date line); everything else resolves empty. Tests
  // override per-path via mockImplementation, not the fragile Once-queue.
  apiMock.mockImplementation(async (path: string) =>
    path === "/seller-profile" ? { profile: {} } : {},
  );
});

const LISTING = {
  id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay" as const,
  marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
  status: "active" as const, price: 1200, currency: "USD",
  createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
  soldAt: null, itemTitle: "ASUS ROG",
};

describe("ListingCard (read-only)", () => {
  it("shows marketplace, status pill, and price", () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
    expect(screen.getAllByText(/ebay/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
  });

  it("links to the live marketplace listing", () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
    const link = screen.getByRole("link", { name: /view on ebay/i });
    expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/307054605978");
  });
});

describe("ListingCard actions", () => {
  it("publishes a draft and calls onChanged", async () => {
    const onChanged = vi.fn();
    render(<ListingCard listing={{ ...LISTING, status: "draft", marketplaceListingId: null }} token="t" onChanged={onChanged} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    expect(apiMock).toHaveBeenCalledWith("/listings/l1/publish", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("opens the aspect sheet prefilled from the item when publish returns EBAY_ASPECTS_REQUIRED", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/publish")) throw new ApiError(422, "EBAY_ASPECTS_REQUIRED", "aspects", []);
      return path === "/seller-profile" ? { profile: {} } : {};
    });
    render(
      <ListingCard
        listing={{ ...LISTING, status: "draft" }}
        token="t"
        onChanged={vi.fn()}
        highlight={false}
        itemBrand="ASUS"
        itemModel="ROG Zephyrus"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    expect(await screen.findByText(/requires these item specifics/i)).toBeInTheDocument();
  });

  it("opens the weight sheet when publish returns EBAY_WEIGHT_REQUIRED", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/publish")) throw new ApiError(422, "EBAY_WEIGHT_REQUIRED", "weight", []);
      return path === "/seller-profile" ? { profile: {} } : {};
    });
    render(<ListingCard listing={{ ...LISTING, status: "draft" }} token="t" onChanged={vi.fn()} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    expect(await screen.findByRole("heading", { name: /add package weight/i })).toBeInTheDocument();
  });

  it("rejects an invalid price inline without calling the API", async () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={vi.fn()} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /edit price/i }));
    const input = screen.getByLabelText(/price/i);
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText("Please enter a valid price")).toBeInTheDocument();
    // No listing mutation may fire (the GTC line's /seller-profile read is fine).
    expect(apiMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/listings/"),
      expect.anything(),
    );
  });

  it("saves an edited price via PATCH and calls onChanged", async () => {
    const onChanged = vi.fn();
    render(<ListingCard listing={LISTING} token="t" onChanged={onChanged} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /edit price/i }));
    const input = screen.getByLabelText(/price/i);
    await userEvent.clear(input);
    await userEvent.type(input, "1150");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/listings/l1", expect.objectContaining({ method: "PATCH", body: { price: 1150 } }));
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("archives an active listing after confirm", async () => {
    const onChanged = vi.fn();
    render(<ListingCard listing={LISTING} token="t" onChanged={onChanged} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /archive/i }));
    await userEvent.click(screen.getByRole("button", { name: /^archive$/i })); // confirm sheet
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/listings/l1", expect.objectContaining({ method: "PATCH", body: { status: "archived" } }));
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("deletes a draft after confirm", async () => {
    const onChanged = vi.fn();
    render(<ListingCard listing={{ ...LISTING, status: "draft", marketplaceListingId: null }} token="t" onChanged={onChanged} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i })); // confirm sheet
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/listings/l1", expect.objectContaining({ method: "DELETE" }));
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("relists a sold listing via the list flow", async () => {
    render(<ListingCard listing={{ ...LISTING, status: "sold", soldAt: "2026-07-01T00:00:00Z" }} token="t" onChanged={vi.fn()} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /relist/i }));
    expect(pushMock).toHaveBeenCalledWith("/list?itemId=i1");
  });

  it("disables Publish with an explanatory tooltip while a price edit is uncommitted", async () => {
    render(<ListingCard listing={{ ...LISTING, status: "draft", marketplaceListingId: null }} token="t" onChanged={vi.fn()} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /edit price/i }));
    const input = screen.getByLabelText(/price/i);
    await userEvent.clear(input);
    await userEvent.type(input, "999");
    const publish = screen.getByRole("button", { name: /publish/i });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute("title", "Save your changes before publishing");
  });

  it("shows the sold date on a sold card", () => {
    render(<ListingCard listing={{ ...LISTING, status: "sold", soldAt: "2026-07-01T00:00:00Z" }} token="t" onChanged={vi.fn()} highlight={false} />);
    expect(screen.getByText(new RegExp(`Sold ${new Date("2026-07-01T00:00:00Z").toLocaleDateString()}`))).toBeInTheDocument();
  });

  it("shows the raw marketplace listing ID with tap-to-copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ListingCard listing={LISTING} token="t" onChanged={vi.fn()} highlight={false} />);
    const idButton = screen.getByRole("button", { name: /307054605978/ });
    await userEvent.click(idButton);
    expect(writeText).toHaveBeenCalledWith("307054605978");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("surfaces a copy failure instead of failing silently (plain-HTTP LAN has no clipboard)", async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<ListingCard listing={LISTING} token="t" onChanged={vi.fn()} highlight={false} />);
    await userEvent.click(screen.getByRole("button", { name: /307054605978/ }));
    expect(await screen.findByText(/couldn't copy/i)).toBeInTheDocument();
  });
});

describe("ListingCard GTC date (ported from listings/[id]/gtc-date.test.tsx)", () => {
  it("shows the auto-end date when the seller has GTC auto-end on", async () => {
    apiMock.mockImplementation(async (path: string) =>
      path === "/seller-profile" ? { profile: { gtcAutoEnd: true } } : {},
    );
    const publishedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    render(<ListingCard listing={{ ...LISTING, publishedAt }} token="t" onChanged={vi.fn()} highlight={false} />);

    const { nextGtcRenewal } = await import("@/lib/gtc");
    const renewal = nextGtcRenewal(new Date(publishedAt));
    const autoEnd = new Date(renewal.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(await screen.findByText(/Auto-ends/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(autoEnd.toLocaleDateString()))).toBeInTheDocument();
  });

  it("shows the GTC renewal date when auto-end is off", async () => {
    apiMock.mockImplementation(async (path: string) =>
      path === "/seller-profile" ? { profile: { gtcAutoEnd: false } } : {},
    );
    const publishedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    render(<ListingCard listing={{ ...LISTING, publishedAt }} token="t" onChanged={vi.fn()} highlight={false} />);

    const { nextGtcRenewal } = await import("@/lib/gtc");
    const renewal = nextGtcRenewal(new Date(publishedAt));
    expect(await screen.findByText(/GTC renews/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(renewal.toLocaleDateString()))).toBeInTheDocument();
    expect(screen.queryByText(/Auto-ends/)).not.toBeInTheDocument();
  });

  it("falls back to the renewal date when the profile fetch fails", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/seller-profile") throw new Error("network");
      return {};
    });
    const publishedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    render(<ListingCard listing={{ ...LISTING, publishedAt }} token="t" onChanged={vi.fn()} highlight={false} />);
    expect(await screen.findByText(/GTC renews/)).toBeInTheDocument();
  });
});

describe("ListingCard price display", () => {
  it("appends the currency code for non-USD listings (Reverb signal)", () => {
    render(<ListingCard listing={{ ...LISTING, marketplace: "reverb", currency: "CAD", price: 1150 }} token="t" onChanged={vi.fn()} highlight={false} />);
    expect(screen.getByText(/CAD$/)).toBeInTheDocument();
  });
});

describe("ListingCard edit path", () => {
  it("links to the item edit page for title & description", () => {
    render(<ListingCard listing={LISTING} token="t" onChanged={vi.fn()} highlight={false} />);
    const link = screen.getByRole("link", { name: /edit title & description/i });
    expect(link).toHaveAttribute("href", "/inventory/i1/edit");
  });
});
