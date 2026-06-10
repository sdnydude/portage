import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompsPricingWidget } from "./comps-pricing-widget";
import type { PricingData, CompResult } from "@portage/shared";

const PRICING: PricingData = {
  suggested: 189,
  low: 165,
  high: 225,
  currency: "USD",
  confidence: "high",
  basedOn: 12,
  conditionMatch: "exact",
};

const EBAY_COMPS: CompResult = {
  sold: Array.from({ length: 12 }, (_, i) => ({
    title: `Comp ${i}`, price: 150 + i * 10, currency: "USD", condition: "GOOD",
    imageUrl: null, listingUrl: "https://ebay.com/itm/1", soldDate: null,
  })),
  active: Array.from({ length: 3 }, (_, i) => ({
    title: `Active ${i}`, price: 200, currency: "USD", condition: "GOOD",
    imageUrl: null, listingUrl: "https://ebay.com/itm/2", soldDate: null,
  })),
  stats: {
    soldMedian: 195, soldAvg: 205, activeMedian: 200, activeAvg: 200,
    sampleSize: 15, p25: 165, p50: 195, p75: 225, sellThrough: 0.8,
  },
};

describe("CompsPricingWidget — percentile bands + sell-through", () => {
  it("renders the three pricing bands and picking one updates the price", () => {
    const onPriceChange = vi.fn();
    render(
      <CompsPricingWidget
        pricing={PRICING}
        comps={{ ebay: EBAY_COMPS, reverb: null }}
        currentPrice={189}
        onPriceChange={onPriceChange}
      />,
    );

    expect(screen.getByText(/move it/i)).toBeInTheDocument();
    expect(screen.getByText(/top dollar/i)).toBeInTheDocument();
    // Hot demand badge from sellThrough 0.8 (12 sold / 3 active)
    expect(screen.getByText(/hot/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /move it/i }));
    expect(onPriceChange).toHaveBeenCalledWith(165);
  });
});
