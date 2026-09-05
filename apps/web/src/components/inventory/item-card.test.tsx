import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemCard } from "./item-card";
import type { Item } from "@/hooks/use-items";

const baseItem = {
  id: "i1",
  title: "SCONPHO M-4 Pan Tilt Head",
  description: "",
  category: "cameras",
  condition: "good",
  brand: "SCONPHO",
  model: "M-4",
  features: [],
  quantity: 1,
  photos: [],
  estimatedValueMin: null,
  estimatedValueMax: null,
  estimatedValueRecommended: 79,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
} as unknown as Item;

describe("ItemCard — Unlisted chip", () => {
  it("shows the chip in both views when listed is false, hides it when true", () => {
    const unlisted = { ...baseItem, listed: false } as Item;
    const listed = { ...baseItem, id: "i2", listed: true } as Item;

    const { rerender } = render(<ItemCard item={unlisted} view="grid" />);
    expect(screen.getByText("Unlisted")).toBeInTheDocument();

    rerender(<ItemCard item={unlisted} view="list" />);
    expect(screen.getByText("Unlisted")).toBeInTheDocument();

    rerender(<ItemCard item={listed} view="grid" />);
    expect(screen.queryByText("Unlisted")).not.toBeInTheDocument();
  });
});

describe("ItemCard — price truth (Housekeeping-1 T4)", () => {
  it("shows the set price and never the estimated-value range", () => {
    const priced = { ...baseItem, price: 125, estimatedValueMin: 80, estimatedValueMax: 160 } as Item;
    const { rerender } = render(<ItemCard item={priced} view="grid" />);
    expect(screen.getByText("$125")).toBeInTheDocument();
    expect(screen.queryByText(/\$80/)).not.toBeInTheDocument();

    rerender(<ItemCard item={{ ...baseItem, price: null } as Item} view="list" />);
    expect(screen.getByText("No price")).toBeInTheDocument();
    expect(screen.queryByText(/~\$79/)).not.toBeInTheDocument();
  });
});

describe("ItemCard — status + marketplace chips (Housekeeping-1 T7)", () => {
  it("shows the derived status chip and one marketplace chip per live listing", () => {
    const live = { ...baseItem, listed: true, displayStatus: "active", liveMarketplaces: ["ebay", "reverb"] } as Item;
    const { rerender } = render(<ItemCard item={live} view="grid" />);
    expect(screen.getByText("Active").getAttribute("style")).toMatch(/--chip-active-fg/);
    expect(screen.getByText("eBay")).toBeInTheDocument();
    expect(screen.getByText("Reverb")).toBeInTheDocument();

    rerender(<ItemCard item={{ ...baseItem, listed: false, displayStatus: "asset", liveMarketplaces: [] } as Item} view="list" />);
    expect(screen.getByText("Asset")).toBeInTheDocument();
    expect(screen.queryByText("eBay")).not.toBeInTheDocument();
  });
});

describe("ItemCard — non-interactive mode", () => {
  it("renders the card content with no link and no button when interactive is false", () => {
    render(<ItemCard item={baseItem} view="grid" interactive={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(baseItem.title)).toBeInTheDocument();
  });
});

describe("ItemCard — workbench button mode", () => {
  it("renders as a button and fires onOpen when provided (workbench mode)", () => {
    const onOpen = vi.fn();
    render(<ItemCard item={baseItem} view="list" onOpen={onOpen} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("marks the selected card with aria-current", () => {
    render(<ItemCard item={baseItem} view="list" onOpen={vi.fn()} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");
  });
});
