import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return { apiMock: vi.fn(), ApiError };
});

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
const prefsMock = vi.hoisted(() => ({ disclaimerSuppressed: false }));
vi.mock("@/hooks/use-user-preferences", () => ({
  useUserPreferences: () => ({ disclaimerSuppressed: prefsMock.disclaimerSuppressed }),
}));
vi.mock("@/lib/api", () => ({ api: h.apiMock, ApiError: h.ApiError }));
// Disclaimer just needs to expose its accept action for the publish path.
vi.mock("./disclaimer-sheet", () => ({
  DisclaimerSheet: ({ onAccept }: { onAccept: (suppress7d: boolean) => void }) => (
    <>
      <button onClick={() => onAccept(false)}>accept-terms</button>
      <button onClick={() => onAccept(true)}>accept-terms-suppress</button>
    </>
  ),
}));

import { CreateListingSheet } from "./create-listing-sheet";

beforeEach(() => h.apiMock.mockReset());

describe("CreateListingSheet — allowedMarketplaces", () => {
  it("offers only the allowed marketplaces when restricted", () => {
    const noop = () => {};
    render(
      <CreateListingSheet itemId="i1" allowedMarketplaces={["reverb"]} onCreated={noop} onClose={noop} />,
    );
    expect(screen.getByRole("button", { name: "Reverb" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "eBay" })).toBeNull();
  });

  it("disables creation when no marketplace is allowed (never falls back to eBay)", () => {
    const noop = () => {};
    render(
      <CreateListingSheet itemId="i1" suggestedPrice={10} allowedMarketplaces={[]} onCreated={noop} onClose={noop} />,
    );
    // Price is prefilled, so only the empty marketplace list may disable this.
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
  });
});

describe("CreateListingSheet — price prefill", () => {
  it("keeps the price input in sync when suggestedPrice resolves after mount", () => {
    const noop = () => {};
    const { rerender } = render(
      <CreateListingSheet itemId="i1" suggestedPrice={10} onCreated={noop} onClose={noop} />,
    );
    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(input.value).toBe("10");

    rerender(<CreateListingSheet itemId="i1" suggestedPrice={20} onCreated={noop} onClose={noop} />);
    expect(input.value).toBe("20");
  });

  it("does not overwrite a user-edited price when a later suggestedPrice arrives", () => {
    const noop = () => {};
    const { rerender } = render(
      <CreateListingSheet itemId="i1" suggestedPrice={10} onCreated={noop} onClose={noop} />,
    );
    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(input.value).toBe("10");

    // User types their own price — now authoritative.
    fireEvent.change(input, { target: { value: "99" } });
    expect(input.value).toBe("99");

    // A late AI/comps suggestion must NOT clobber the user's edit.
    rerender(<CreateListingSheet itemId="i1" suggestedPrice={20} onCreated={noop} onClose={noop} />);
    expect(input.value).toBe("99");
  });

  it("re-adopts the suggestion when the sheet is reused for a different item", () => {
    const noop = () => {};
    const { rerender } = render(
      <CreateListingSheet itemId="item-a" suggestedPrice={10} onCreated={noop} onClose={noop} />,
    );
    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "99" } }); // user edits item A
    expect(input.value).toBe("99");

    // Sheet reused for a NEW item — the edit guard must reset so item B's suggestion applies.
    rerender(<CreateListingSheet itemId="item-b" suggestedPrice={20} onCreated={noop} onClose={noop} />);
    expect(input.value).toBe("20");
  });
});

describe("CreateListingSheet — required aspects are collectable, not a dead-end", () => {
  it("offers Reverb as a marketplace and posts marketplace 'reverb' when selected", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={200} onCreated={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Reverb"));
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    expect(bodies[0].marketplace).toBe("reverb");
    // The eBay-draft toggle must not render for Reverb.
    expect(screen.queryByText("Save as eBay draft")).toBeNull();
  });

  it("sends publishMode 'ebay_draft' when the eBay-draft toggle is on (not publishing now)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    // publishNow stays OFF; turn on the eBay-draft toggle, then save
    const ebayToggle = screen.getByText("Save as eBay draft").closest("label")!.querySelector("div")!;
    fireEvent.click(ebayToggle);
    fireEvent.click(screen.getByText("Save eBay Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    expect(bodies[0].publishMode).toBe("ebay_draft");
  });

  it("shows where the prefilled price came from (provenance hint)", () => {
    render(
      <CreateListingSheet itemId="i1" suggestedPrice={95} priceSource="comps" onCreated={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/market comps/i)).toBeInTheDocument();
  });

  it("defaults the publish-now path on when initialPublishNow is set (seller profile = live)", () => {
    render(
      <CreateListingSheet itemId="i1" suggestedPrice={65} initialPublishNow onCreated={vi.fn()} onClose={vi.fn()} />,
    );
    // publishNow on → the primary action reviews terms before publishing, not "Save Draft".
    expect(screen.getByText("Review Terms")).toBeInTheDocument();
  });

  it("carries scan prefill (categoryId + aspects + eBay-draft default) into the listing POST", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(
      <CreateListingSheet
        itemId="i1"
        suggestedPrice={65}
        initialEbayDraft
        categoryId="175669"
        initialAspects={{ Brand: ["Apple"], MPN: ["Does Not Apply"] }}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // eBay-draft default is on → the button is the draft action; just save.
    fireEvent.click(screen.getByText("Save eBay Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    expect(bodies[0].publishMode).toBe("ebay_draft");
    expect((bodies[0].marketplaceSpecificFields as { categoryId?: string })?.categoryId).toBe("175669");
    expect((bodies[0].marketplaceSpecificFields as { aspects?: Record<string, string[]> })?.aspects).toEqual({
      Brand: ["Apple"],
      MPN: ["Does Not Apply"],
    });
  });

  it("sends disclaimerAccepted on a publish-now (after accepting terms) so consent is recorded", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "active" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    await waitFor(() => expect(bodies.length).toBe(1));
    expect(bodies[0].publishMode).toBe("live");
    expect(bodies[0].disclaimerAccepted).toBe(true);
  });

  it("sends suppress7d when the seller accepts terms with 'don't show for 7 days' checked", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "active" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms-suppress"));

    await waitFor(() => expect(bodies.length).toBe(1));
    expect(bodies[0].disclaimerAccepted).toBe(true);
    expect(bodies[0].suppress7d).toBe(true);
  });

  it("skips the terms sheet and publishes directly when the seller is within the 7-day suppression", async () => {
    prefsMock.disclaimerSuppressed = true;
    try {
      const bodies: Array<Record<string, unknown>> = [];
      h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
        if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "active" }; }
        return {};
      });

      render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

      const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
      fireEvent.click(toggle);
      // Suppressed → the primary action publishes directly; no terms sheet.
      fireEvent.click(screen.getByText("Publish"));

      await waitFor(() => expect(bodies.length).toBe(1));
      expect(bodies[0].publishMode).toBe("live");
      expect(bodies[0].disclaimerAccepted).toBe(true);
      expect(screen.queryByText("accept-terms")).not.toBeInTheDocument();
    } finally {
      prefsMock.disclaimerSuppressed = false;
    }
  });

  it("shows About-page terms microcopy on the suppressed publish path", () => {
    prefsMock.disclaimerSuppressed = true;
    try {
      render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);
      const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
      fireEvent.click(toggle);
      const link = screen.getByRole("link", { name: /about page/i });
      expect(link).toHaveAttribute("href", "/about");
    } finally {
      prefsMock.disclaimerSuppressed = false;
    }
  });

  it("shows the aspect-fill sheet when publish needs item specifics, then retries with them filled", async () => {
    const onCreated = vi.fn();
    let listingsCalls = 0;
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") {
        listingsCalls += 1;
        bodies.push(opts?.body ?? {});
        if (listingsCalls === 1) {
          throw new h.ApiError(400, "EBAY_ASPECTS_REQUIRED", "eBay needs these item specifics filled in: Type", [
            { name: "Type", values: ["Dynamic", "Condenser"] },
          ]);
        }
        return { id: "L1", status: "active" };
      }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={onCreated} onClose={vi.fn()} />);

    // the toggle's onClick is on an inner div (not the label text)
    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    // the dead-end is gone: the aspect-fill sheet appears with the missing "Type"
    expect(await screen.findByText("Complete eBay details")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dynamic" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    // F4: the retry lands on the result screen; onCreated fires on dismissal.
    await screen.findByText("Published");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(listingsCalls).toBe(2);
    expect((bodies[1].marketplaceSpecificFields as { aspects?: Record<string, string[]> })?.aspects).toEqual({
      Type: ["Dynamic"],
    });
  });

  it("shows a published-success result after a live publish, then reaches onCreated via Done", async () => {
    const onCreated = vi.fn();
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/listings") return { id: "L1", status: "active" };
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={onCreated} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    // The sheet no longer silently navigates — it confirms the result first.
    expect(await screen.findByText("Published")).toBeInTheDocument();
    // onCreated only fires when the seller dismisses the result.
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onCreated).toHaveBeenCalled();
  });

  it("shows a draft-saved result with eBay's verbatim reason when publish falls back to draft", async () => {
    const reason = "Your eBay account has a security restriction (ATO_TASR_block). Listing saved as a draft.";
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/listings") return { id: "L1", status: "draft", warning: reason };
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    expect(await screen.findByText("Saved as draft")).toBeInTheDocument();
    // eBay's actual reason is surfaced verbatim, not a generic line.
    expect(screen.getByRole("alert")).toHaveTextContent(reason);
  });

  it("routes the aspect-fill publish through the same result screen", async () => {
    const onCreated = vi.fn();
    let listingsCalls = 0;
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/listings") {
        listingsCalls += 1;
        if (listingsCalls === 1) {
          throw new h.ApiError(400, "EBAY_ASPECTS_REQUIRED", "eBay needs these item specifics filled in: Type", [
            { name: "Type", values: ["Dynamic"] },
          ]);
        }
        return { id: "L1", status: "active" };
      }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={onCreated} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));
    await screen.findByText("Complete eBay details");
    fireEvent.click(screen.getByRole("button", { name: "Dynamic" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    // Same truthful result — not a silent navigate.
    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onCreated).toHaveBeenCalled();
  });

  it("disables Save & publish while the aspect-fill retry POST is in flight (no duplicate listing)", async () => {
    let listingsCalls = 0;
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/listings") {
        listingsCalls += 1;
        if (listingsCalls === 1) {
          throw new h.ApiError(400, "EBAY_ASPECTS_REQUIRED", "eBay needs these item specifics filled in: Type", [
            { name: "Type", values: ["Dynamic"] },
          ]);
        }
        // Retry: never resolves, so the in-flight busy state stays observable.
        return new Promise(() => {});
      }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    await screen.findByText("Complete eBay details");
    fireEvent.click(screen.getByRole("button", { name: "Dynamic" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    // The retry is in flight: the button must flip to the busy, disabled state so a
    // second tap can't fire another POST /listings.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled(),
    );
    expect(listingsCalls).toBe(2);
  });
});

describe("CreateListingSheet — publish idempotencyKey", () => {
  it("sends the SAME idempotencyKey on the aspects-retry as on the failed first publish", async () => {
    let listingsCalls = 0;
    const bodies: Array<{ idempotencyKey?: string }> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") {
        listingsCalls += 1;
        bodies.push((opts?.body ?? {}) as { idempotencyKey?: string });
        if (listingsCalls === 1) {
          throw new h.ApiError(400, "EBAY_ASPECTS_REQUIRED", "eBay needs these item specifics filled in: Type", [
            { name: "Type", values: ["Dynamic", "Condenser"] },
          ]);
        }
        return { id: "L1", status: "active" };
      }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={65} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Publish immediately").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Review Terms"));
    fireEvent.click(screen.getByText("accept-terms"));

    await screen.findByText("Complete eBay details");
    fireEvent.click(screen.getByRole("button", { name: "Dynamic" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));
    await screen.findByText("Published");

    // The first attempt's insert-first row is keyed server-side; the retry must
    // collide on it (resume) instead of inserting an orphan draft per attempt.
    expect(bodies).toHaveLength(2);
    expect(bodies[0].idempotencyKey).toEqual(expect.any(String));
    expect(bodies[0].idempotencyKey!.length).toBeGreaterThan(0);
    expect(bodies[1].idempotencyKey).toBe(bodies[0].idempotencyKey);
  });
});
