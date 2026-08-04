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

describe("ListingCard sync badge (P3)", () => {
  it("renders the failed badge with message and fires onRetrySync from the retry button", async () => {
    const onRetrySync = vi.fn().mockResolvedValue(undefined);
    render(
      <ListingCard
        listing={LISTING}
        token="t"
        onChanged={() => {}}
        highlight={false}
        syncStatus={{ listingId: "l1", state: "failed", lastAttemptAt: "2026-08-03T09:00:00Z", message: "Reverb 422: shipping required" }}
        onRetrySync={onRetrySync}
      />,
    );
    expect(screen.getByTestId("sync-badge-l1")).toHaveTextContent(/sync failed/i);
    expect(screen.getByText(/Reverb 422: shipping required/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry sync/i }));
    expect(onRetrySync).toHaveBeenCalledWith("l1");
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

describe("ListingCard — Best Offer edit (BO-5)", () => {
  const BO_LISTING = {
    ...LISTING,
    marketplaceSpecificFields: { bestOfferEnabled: true, bestOfferAutoAcceptPrice: 209, minimumBestOfferPrice: 199 },
  };

  it("shows Best Offer fields pre-filled from the stored config when editing the price of an eBay listing", async () => {
    const user = userEvent.setup();
    render(<ListingCard listing={BO_LISTING} token="t" onChanged={() => {}} highlight={false} />);

    await user.click(screen.getByRole("button", { name: /edit price/i }));

    expect(screen.getByLabelText(/auto-accept/i)).toHaveValue(209);
    expect(screen.getByLabelText(/minimum offer/i)).toHaveValue(199);
  });

  it("saves edited thresholds with the price — cleared field rides as null so the server deletes it", async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string) =>
      path === "/seller-profile" ? { profile: {} } : { id: "l1" });
    render(<ListingCard listing={BO_LISTING} token="t" onChanged={() => {}} highlight={false} />);

    await user.click(screen.getByRole("button", { name: /edit price/i }));
    const accept = screen.getByLabelText(/auto-accept/i);
    await user.clear(accept);
    await user.type(accept, "180");
    const min = screen.getByLabelText(/minimum offer/i);
    await user.clear(min); // cleared → null → server deletes the key
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const patch = apiMock.mock.calls.find(([p, opts]) => p === "/listings/l1" && (opts as { method?: string })?.method === "PATCH");
      expect(patch).toBeDefined();
      const body = (patch![1] as { body: Record<string, unknown> }).body;
      expect(body.price).toBe(1200);
      expect(body.marketplaceSpecificFields).toEqual({
        bestOfferEnabled: true,
        bestOfferAutoAcceptPrice: 180,
        minimumBestOfferPrice: null,
      });
    });
  });

  it("turning offers off sends the explicit disable triple — the only path that clears thresholds", async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string) =>
      path === "/seller-profile" ? { profile: {} } : { id: "l1" });
    render(<ListingCard listing={BO_LISTING} token="t" onChanged={() => {}} highlight={false} />);

    await user.click(screen.getByRole("button", { name: /edit price/i }));
    await user.click(screen.getByLabelText(/accept offers/i)); // uncheck
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const patch = apiMock.mock.calls.find(([p, opts]) => p === "/listings/l1" && (opts as { method?: string })?.method === "PATCH");
      expect(patch).toBeDefined();
      const body = (patch![1] as { body: Record<string, unknown> }).body;
      expect(body.marketplaceSpecificFields).toEqual({
        bestOfferEnabled: false,
        bestOfferAutoAcceptPrice: null,
        minimumBestOfferPrice: null,
      });
    });
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

describe("ListingCard — Reverb offers toggle (RV-1)", () => {
  it("a Reverb listing's price editor carries an offers toggle that PATCHes offersEnabledExplicit only", async () => {
    let patchBody: Record<string, unknown> | undefined;
    apiMock.mockImplementation(async (path: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/listings/l1" && opts?.method === "PATCH") { patchBody = opts.body; return {}; }
      return path === "/seller-profile" ? { profile: {} } : {};
    });
    render(
      <ListingCard
        listing={{ ...LISTING, marketplace: "reverb" as const, marketplaceListingId: "87654321", marketplaceSpecificFields: { offersEnabledExplicit: true } }}
        token="t" onChanged={vi.fn()} highlight={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /edit price/i }));
    const toggle = screen.getByLabelText(/accept offers/i);
    expect(toggle).toBeChecked();
    await userEvent.click(toggle); // turn offers off for this listing
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(patchBody).toBeDefined());
    expect(patchBody!.marketplaceSpecificFields).toEqual({ offersEnabledExplicit: false });
  });
});

describe("ListingCard — key-scoped specifics saves (C2)", () => {
  it("shipping save sends ONLY ebayShipping — stale sibling spread would defeat the server's atomic merge", async () => {
    let patchBody: Record<string, unknown> | undefined;
    apiMock.mockImplementation(async (path: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/listings/l1" && opts?.method === "PATCH") { patchBody = opts.body; return { warning: undefined }; }
      if (path === "/seller-profile") return { profile: {} };
      return {};
    });
    render(
      <ListingCard
        listing={{ ...LISTING, marketplaceSpecificFields: { aspects: { Brand: ["ASUS"] }, categoryId: "177" } }}
        token="t" onChanged={vi.fn()} highlight={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /edit shipping/i }));
    await userEvent.selectOptions(screen.getByLabelText(/shipping method/i), "flat");
    await userEvent.clear(screen.getByLabelText(/buyer pays/i));
    await userEvent.type(screen.getByLabelText(/buyer pays/i), "9.99");
    await userEvent.click(screen.getByRole("button", { name: /save shipping/i }));

    await waitFor(() => expect(patchBody).toBeDefined());
    expect(patchBody!.marketplaceSpecificFields).toEqual({
      ebayShipping: { method: "flat", flatCost: 9.99 },
    });
  });
});

// The client-spread shipping test was superseded by C2: the server merges
// atomically and the key-scoped payload is pinned in the C2 describe above.

describe("ListingCard — key-scoped aspects save (C2)", () => {
  it("aspects save sends ONLY the merged aspects bag, no sibling spread", async () => {
    let patchBody: Record<string, unknown> | undefined;
    apiMock.mockImplementation(async (path: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
      if (String(path).includes("/publish")) throw new ApiError(422, "EBAY_ASPECTS_REQUIRED", "aspects", [{ name: "MPN", values: null }] as never);
      if (path === "/listings/l1" && opts?.method === "PATCH") { patchBody = opts.body; return {}; }
      return path === "/seller-profile" ? { profile: {} } : {};
    });
    render(
      <ListingCard
        listing={{ ...LISTING, status: "draft" as const, marketplaceListingId: null, marketplaceSpecificFields: { categoryId: "177", aspects: { Brand: ["ASUS"] } } }}
        token="t" onChanged={vi.fn()} highlight={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    await screen.findByText(/requires these item specifics/i);
    await userEvent.type(screen.getByPlaceholderText("Enter MPN"), "X570");
    await userEvent.click(screen.getByRole("button", { name: /save & publish/i }));

    await waitFor(() => expect(patchBody).toBeDefined());
    expect(Object.keys(patchBody!.marketplaceSpecificFields as Record<string, unknown>)).toEqual(["aspects"]);
    expect((patchBody!.marketplaceSpecificFields as { aspects: Record<string, string[]> }).aspects).toMatchObject({
      Brand: ["ASUS"], MPN: ["X570"],
    });
  });
});
