import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
