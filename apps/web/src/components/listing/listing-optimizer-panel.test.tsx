import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { ListingOptimizerPanel } from "./listing-optimizer-panel";

const RESEARCH = {
  category: { categoryId: "175669", categoryName: "Solid State Drives" },
  aspects: {
    filled: [{ name: "Brand", required: true, values: ["Nextorage"] }, { name: "Color", required: false, values: ["Black"] }],
    missing: [
      { name: "Interface", required: false, suggestedValues: ["SATA III", "PCIe"], cardinality: "SINGLE" },
      { name: "Capacity", required: false, suggestedValues: null, cardinality: "SINGLE" },
    ],
  },
  demand: { soldMedian: 135.49, soldAvg: 140, activeMedian: 150, activeAvg: 150, sampleSize: 6, sellThrough: 0.5, soldCount: 3, activeCount: 3 },
  traffic: null,
};

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue(RESEARCH);
});

describe("ListingOptimizerPanel", () => {
  it("renders the aspect gap, filled aspects, and market demand", async () => {
    render(<ListingOptimizerPanel itemId="i1" />);

    await waitFor(() => expect(screen.getByText("Interface")).toBeInTheDocument());
    // missing-aspect suggested values render as tappable quick-fill chips
    expect(screen.getByRole("button", { name: "SATA III" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PCIe" })).toBeInTheDocument();
    // filled aspect is shown
    expect(screen.getByText("Brand")).toBeInTheDocument();
    // market demand readout includes the sold median
    expect(screen.getByText(/135/)).toBeInTheDocument();
  });

  it("fills a missing aspect from a suggested chip → PATCH /items, then refetches and notifies", async () => {
    apiMock.mockReset();
    apiMock
      .mockResolvedValueOnce(RESEARCH) // initial research load
      .mockResolvedValueOnce({}) // PATCH /items
      .mockResolvedValueOnce(RESEARCH); // research refetch
    const onFilled = vi.fn();

    render(<ListingOptimizerPanel itemId="i1" onFilled={onFilled} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "SATA III" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "SATA III" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/items/i1", {
        method: "PATCH",
        body: { aspects: { Interface: ["SATA III"] } },
        token: "t",
      }),
    );
    await waitFor(() => expect(onFilled).toHaveBeenCalled());
  });

  it("removes a filled aspect → PATCH /items with the key as null, then refetches and notifies (Housekeeping-1 T3)", async () => {
    apiMock.mockReset();
    apiMock
      .mockResolvedValueOnce(RESEARCH) // initial research load
      .mockResolvedValueOnce({}) // PATCH /items
      .mockResolvedValueOnce(RESEARCH); // research refetch
    const onFilled = vi.fn();

    render(<ListingOptimizerPanel itemId="i1" onFilled={onFilled} />);
    await waitFor(() => expect(screen.getByText("Color")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Remove Color" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/items/i1", {
        method: "PATCH",
        body: { aspects: { Color: null } },
        token: "t",
      }),
    );
    await waitFor(() => expect(onFilled).toHaveBeenCalled());
  });

  it("never offers Remove on a category-REQUIRED filled specific — eBay would refuse the next revise (review)", async () => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({
      ...RESEARCH,
      aspects: { filled: [{ name: "Brand", required: true, values: ["Nextorage"] }, { name: "Color", required: false, values: ["Black"] }], missing: [] },
    });
    render(<ListingOptimizerPanel itemId="i1" />);
    await waitFor(() => expect(screen.getByText("Color")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove Brand" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Color" })).toBeInTheDocument();
  });

  it("surfaces syncWarnings from the remove PATCH instead of reporting silent success (review)", async () => {
    apiMock.mockReset();
    apiMock
      .mockResolvedValueOnce({ ...RESEARCH, aspects: { filled: [{ name: "Color", required: false, values: ["Black"] }], missing: [] } })
      .mockResolvedValueOnce({ syncWarnings: ["ebay: listing 3001 sync could not be queued — edit saved, retry from the listing page"] })
      .mockResolvedValueOnce({ ...RESEARCH, aspects: { filled: [], missing: [] } });
    render(<ListingOptimizerPanel itemId="i1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove Color" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Remove Color" }));
    expect(await screen.findByText(/could not be queued/)).toBeInTheDocument();
  });
});
