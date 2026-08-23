import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip, MarketplaceChip } from "./status-chip";

describe("StatusChip (Housekeeping-1 T7)", () => {
  it("renders the human label for status=asset on chip tokens, not raw Tailwind palette classes", () => {
    const { container } = render(<StatusChip status="asset" />);
    const chip = screen.getByText("Asset");
    expect(chip.getAttribute("style")).toMatch(/--chip-asset-fg/);
    expect(container.innerHTML).not.toMatch(/amber-|emerald-|zinc-|blue-/);
  });

  it("renders the marketplace label (eBay / Reverb) as a chip", () => {
    render(<><MarketplaceChip marketplace="ebay" /><MarketplaceChip marketplace="reverb" /></>);
    expect(screen.getByText("eBay")).toBeInTheDocument();
    expect(screen.getByText("Reverb")).toBeInTheDocument();
  });

  it("falls back to Unlisted for an unknown status and echoes an unknown marketplace name", () => {
    render(<><StatusChip status={"bogus" as never} /><MarketplaceChip marketplace="etsy" /><MarketplaceChip marketplace="amazon" /></>);
    expect(screen.getByText("Unlisted")).toBeInTheDocument();
    expect(screen.getByText("Etsy")).toBeInTheDocument();
    expect(screen.getByText("amazon")).toBeInTheDocument();
  });
});
