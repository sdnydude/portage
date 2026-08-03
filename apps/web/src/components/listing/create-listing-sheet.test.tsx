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

  it("sends bestOfferEnabled + min/auto-accept in marketplaceSpecificFields when Accept offers is toggled on (eBay)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={100} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Accept offers").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Minimum offer ($)"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Auto-accept at ($)"), { target: { value: "85" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    const fields = bodies[0].marketplaceSpecificFields as Record<string, unknown>;
    expect(fields.bestOfferEnabled).toBe(true);
    expect(fields.minimumBestOfferPrice).toBe(60);
    expect(fields.bestOfferAutoAcceptPrice).toBe(85);
  });

  it("seeds visible Best Offer fields from initialBestOffer so an AI-prepared floor is seen, not invisible config (BO-5)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={100} initialBestOffer={{ bestOfferAutoAcceptPrice: 85 }} onCreated={vi.fn()} onClose={vi.fn()} />);

    // The seed is visible in the sheet, not just riding the POST silently.
    expect(screen.getByLabelText("Auto-accept at ($)")).toHaveValue(85);

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(bodies.length).toBe(1));
    const fields = bodies[0].marketplaceSpecificFields as Record<string, unknown>;
    expect(fields.bestOfferEnabled).toBe(true);
    expect(fields.bestOfferAutoAcceptPrice).toBe(85);
  });

  it("sends offersEnabledExplicit only when the Reverb toggle is touched; untouched sends no offer fields", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    // Untouched eBay draft-save → no offer keys at all (profile/server defaults own it).
    const first = render(<CreateListingSheet itemId="i1" suggestedPrice={100} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(bodies.length).toBe(1));
    const untouched = (bodies[0].marketplaceSpecificFields ?? {}) as Record<string, unknown>;
    expect(untouched.bestOfferEnabled).toBeUndefined();
    expect(untouched.offersEnabledExplicit).toBeUndefined();
    first.unmount();

    // Reverb: toggle defaults ON; flipping it OFF sends offersEnabledExplicit: false.
    render(<CreateListingSheet itemId="i2" suggestedPrice={100} allowedMarketplaces={["reverb"]} onCreated={vi.fn()} onClose={vi.fn()} />);
    const toggle = screen.getByText("Accept offers").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(bodies.length).toBe(2));
    const fields = bodies[1].marketplaceSpecificFields as Record<string, unknown>;
    expect(fields.offersEnabledExplicit).toBe(false);
    expect(fields.bestOfferEnabled).toBeUndefined();
  });

  it("sends ebayAdRate when Promote is toggled on with a rate (eBay)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={100} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Promote this listing").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Ad rate (% of sale)"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    const fields = bodies[0].marketplaceSpecificFields as Record<string, unknown>;
    expect(fields.ebayAdRate).toBe(5);
  });

  it("sends reverbBumpBid as a fraction of the selected percent (Reverb)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    h.apiMock.mockImplementation(async (path: string, opts?: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { bodies.push(opts?.body ?? {}); return { id: "L1", status: "draft" }; }
      return {};
    });

    render(<CreateListingSheet itemId="i1" suggestedPrice={100} allowedMarketplaces={["reverb"]} onCreated={vi.fn()} onClose={vi.fn()} />);

    const toggle = screen.getByText("Promote this listing").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Bump bid (% of sale)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(bodies.length).toBe(1));
    const fields = bodies[0].marketplaceSpecificFields as Record<string, unknown>;
    expect(fields.reverbBumpBid).toBe(0.025);
    expect(fields.ebayAdRate).toBeUndefined();
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

describe("CreateListingSheet — per-listing shipping (beta 17be7322)", () => {
  it("shows the Shipping method control for eBay, defaulting to Calculated", () => {
    const noop = () => {};
    render(<CreateListingSheet itemId="i1" suggestedPrice={10} onCreated={noop} onClose={noop} />);
    const select = screen.getByLabelText(/shipping method/i) as HTMLSelectElement;
    expect(select.value).toBe("calculated");
  });

  it("sends ebayShipping on the POST only when touched — flat cost, service and handling ride along", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/shipping method/i), { target: { value: "flat" } });
    fireEvent.change(screen.getByLabelText(/buyer pays/i), { target: { value: "6.50" } });
    fireEvent.change(screen.getByLabelText(/^service$/i), { target: { value: "UPSGround" } });
    fireEvent.change(screen.getByLabelText(/handling/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).ebayShipping).toEqual({
      method: "flat", flatCost: 6.5, service: "UPSGround", handlingDays: 3,
    });
  });

  it("Reverb: Local-pickup-only is a TOGGLE (not a select option) and rides the POST as localPickupOnly", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/marketplace/reverb/shipping-profiles") return { profiles: [{ id: "789", name: "Guitars (US)" }] };
      if (path === "/marketplace/reverb/product-types") return { productTypes: [] };
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    await screen.findByLabelText(/shipping profile/i);
    // No pickup entry in the pull-down anymore.
    expect(screen.queryByRole("option", { name: /local pickup only/i })).toBeNull();
    const toggle = screen.getByText(/local pickup only/i).closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).reverbShipping).toEqual({ localPickupOnly: true });
  });

  it("Reverb: loads shipping profiles into the select and sends reverbShipping.profileId when chosen", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/marketplace/reverb/shipping-profiles") {
        return { profiles: [{ id: "789", name: "Guitars (US)" }] };
      }
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    const select = (await screen.findByLabelText(/shipping profile/i)) as HTMLSelectElement;
    await screen.findByRole("option", { name: "Guitars (US)" });
    fireEvent.change(select, { target: { value: "789" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).reverbShipping).toEqual({ profileId: "789" });
  });

  it("initialShipping (scan-review ride-along) seeds the fields AND counts as touched", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(
      <CreateListingSheet
        itemId="i1" suggestedPrice={50}
        initialShipping={{ method: "flat", flatCost: "7.25", service: "USPSMedia", handlingDays: "" }}
        onCreated={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect((screen.getByLabelText(/shipping method/i) as HTMLSelectElement).value).toBe("flat");
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).ebayShipping).toEqual({
      method: "flat", flatCost: 7.25, service: "USPSMedia",
    });
  });

  it("Local pickup toggle rides the POST as ebayShipping.localPickup", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    const toggle = screen.getByText(/offer local pickup/i).closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).ebayShipping).toEqual({
      method: "calculated", localPickup: true,
    });
  });

  it("pickup toggle survives later shipping edits (service/handling) — no stale-state clobber", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/shipping method/i), { target: { value: "flat" } });
    fireEvent.change(screen.getByLabelText(/buyer pays/i), { target: { value: "6.50" } });
    const toggle = screen.getByText(/offer local pickup/i).closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    // Later edits must not drop the flag.
    fireEvent.change(screen.getByLabelText(/^service$/i), { target: { value: "UPSGround" } });
    fireEvent.change(screen.getByLabelText(/handling/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).ebayShipping).toEqual({
      method: "flat", flatCost: 6.5, service: "UPSGround", handlingDays: 3, localPickup: true,
    });
  });

  it("untouched shipping sends no ebayShipping key (server defaults stay in charge)", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: string, opts: { body?: Record<string, unknown> }) => {
      if (path === "/listings") { body = opts.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    const fields = body!.marketplaceSpecificFields as Record<string, unknown> | undefined;
    expect(fields?.ebayShipping).toBeUndefined();
  });
});

describe("CreateListingSheet — Reverb category cascade", () => {
  it("sends the chosen category as marketplaceSpecificFields.categoryUuid on a Reverb POST", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: unknown, opts?: { body?: Record<string, unknown> }) => {
      const p = String(path ?? "");
      if (p === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (p.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      if (p === "/marketplace/reverb/shipping-profiles") return { profiles: [] };
      if (p === "/listings") { body = opts?.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    fireEvent.change(await screen.findByLabelText(/product type/i), { target: { value: "root-fx" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).categoryUuid).toBe("root-fx");
  });
});

describe("CreateListingSheet — Reverb bump rate input", () => {
  it("bump rate is a user-typed field (not a popup menu) and rides the POST as a fraction", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: unknown, opts?: { body?: Record<string, unknown> }) => {
      const p = String(path ?? "");
      if (p === "/marketplace/reverb/shipping-profiles") return { profiles: [] };
      if (p === "/marketplace/reverb/product-types") return { productTypes: [] };
      if (p === "/listings") { body = opts?.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    const promoteToggle = screen.getByText(/promote this listing/i).closest("label")!.querySelector("div")!;
    fireEvent.click(promoteToggle);

    const bump = screen.getByLabelText(/bump bid/i) as HTMLInputElement;
    expect(bump.tagName).toBe("INPUT");
    fireEvent.change(bump, { target: { value: "2.2" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect((body!.marketplaceSpecificFields as Record<string, unknown>).reverbBumpBid).toBeCloseTo(0.022);
  });
});

describe("CreateListingSheet — Reverb category pre-seed", () => {
  it("seeds the cascade with the category that will publish: item cache first, suggestion fallback", async () => {
    h.apiMock.mockImplementation(async (path: unknown) => {
      const p = String(path ?? "");
      if (p === "/items/i1") {
        return { id: "i1", title: "ProCo RAT 2", category: "pedals", marketplaceData: {} }; // no reverb cache
      }
      if (p.startsWith("/marketplace/reverb/category-suggestion")) {
        return { suggestion: { uuid: "u-dist", fullName: "Effects and Pedals / Distortion" } };
      }
      if (p === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (p === "/marketplace/reverb/subcategories?parent=root-fx") {
        return { subcategories: [{ uuid: "u-dist", fullName: "Effects and Pedals / Distortion", name: "Distortion", rootUuid: "root-fx", listable: true }] };
      }
      if (p.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      if (p === "/marketplace/reverb/shipping-profiles") return { profiles: [] };
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    // The cascade hydrates to the suggested category — not an unexplained default.
    await waitFor(() => {
      expect((screen.getByLabelText(/product type/i) as HTMLSelectElement).value).toBe("root-fx");
    });
    expect((screen.getByLabelText(/subcategory 1/i) as HTMLSelectElement).value).toBe("u-dist");
  });
});

describe("CreateListingSheet — review findings (2026-08-02)", () => {
  it("does NOT re-seed a category the seller explicitly reset after toggling marketplaces away and back", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: unknown, opts?: { body?: Record<string, unknown> }) => {
      const p = String(path ?? "");
      if (p === "/items/i1") return { id: "i1", title: "ProCo RAT 2", category: "pedals", marketplaceData: {} };
      if (p.startsWith("/marketplace/reverb/category-suggestion")) {
        return { suggestion: { uuid: "u-dist", fullName: "Effects and Pedals / Distortion" } };
      }
      if (p === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (p === "/marketplace/reverb/subcategories?parent=root-fx") {
        return { subcategories: [{ uuid: "u-dist", fullName: "Effects and Pedals / Distortion", name: "Distortion", rootUuid: "root-fx", listable: true }] };
      }
      if (p.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      if (p === "/marketplace/reverb/shipping-profiles") return { profiles: [] };
      if (p === "/listings") { body = opts?.body; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    await waitFor(() => {
      expect((screen.getByLabelText(/product type/i) as HTMLSelectElement).value).toBe("root-fx");
    });
    // Seller explicitly resets to the default…
    fireEvent.change(screen.getByLabelText(/product type/i), { target: { value: "" } });
    // …then flips to eBay and back to Reverb.
    fireEvent.click(screen.getByRole("button", { name: "eBay" }));
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    await screen.findByLabelText(/shipping profile/i);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    // The rejected seed must NOT ride the POST.
    expect((body!.marketplaceSpecificFields as Record<string, unknown> | undefined)?.categoryUuid).toBeUndefined();
  });
});

describe("CreateListingSheet — offers touched is per-marketplace (review finding)", () => {
  it("an eBay offers touch must NOT ride a later Reverb POST as offersEnabledExplicit", async () => {
    let body: Record<string, unknown> | undefined;
    h.apiMock.mockImplementation(async (path: unknown, opts?: { body?: Record<string, unknown> }) => {
      const p = String(path ?? "");
      if (p === "/listings") { body = opts?.body; return { id: "L1", status: "draft" }; }
      if (p === "/marketplace/reverb/shipping-profiles") return { profiles: [] };
      if (p === "/marketplace/reverb/product-types") return { productTypes: [] };
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    // On eBay (default): flip Accept offers on, then off — touched, value false.
    const toggle = screen.getByText("Accept offers").closest("label")!.querySelector("div")!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    // Switch to Reverb (whose default is offers ON) and save without touching offers.
    fireEvent.click(screen.getByRole("button", { name: "Reverb" }));
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(body).toBeDefined());
    const fields = body!.marketplaceSpecificFields as Record<string, unknown> | undefined;
    expect(fields?.offersEnabledExplicit).toBeUndefined();
  });
});

describe("CreateListingSheet — flat rate requires a cost (review finding)", () => {
  it("blocks the save with an error when method=flat and no buyer cost is entered", async () => {
    let posted = false;
    h.apiMock.mockImplementation(async (path: unknown) => {
      const p = String(path ?? "");
      if (p === "/listings") { posted = true; return { id: "L1", status: "draft" }; }
      return {};
    });
    render(<CreateListingSheet itemId="i1" suggestedPrice={50} onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/shipping method/i), { target: { value: "flat" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText(/flat-rate shipping needs a buyer cost/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });
});
