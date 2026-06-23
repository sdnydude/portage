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
vi.mock("@/lib/api", () => ({ api: h.apiMock, ApiError: h.ApiError }));
// Disclaimer just needs to expose its accept action for the publish path.
vi.mock("./disclaimer-sheet", () => ({
  DisclaimerSheet: ({ onAccept }: { onAccept: () => void }) => (
    <button onClick={onAccept}>accept-terms</button>
  ),
}));

import { CreateListingSheet } from "./create-listing-sheet";

beforeEach(() => h.apiMock.mockReset());

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

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(listingsCalls).toBe(2);
    expect((bodies[1].marketplaceSpecificFields as { aspects?: Record<string, string[]> })?.aspects).toEqual({
      Type: ["Dynamic"],
    });
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
