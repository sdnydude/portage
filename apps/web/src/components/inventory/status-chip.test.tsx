import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip, MarketplaceChip } from "./status-chip";

// WCAG 2.1 relative luminance / contrast ratio (operator: tags unreadable in
// light mode, 2026-09-06). The --chip-* tokens (globals.css) already measure
// well above 4.5:1 (min 6.29:1, see docs), so this pins the other light-mode
// tag surface Lane D owns: item-detail.tsx's `conditionColors` map, which
// uses Tailwind default-palette classes rather than --chip-* tokens.
function relLum(hex: string): number {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(hexA: string, hexB: string): number {
  const [l1, l2] = [relLum(hexA), relLum(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
// Tailwind default-palette hex for the shades conditionColors references.
const TAILWIND_HEX: Record<string, string> = {
  "emerald-100": "#D1FAE5", "emerald-700": "#047857",
  "green-100": "#DCFCE7", "green-700": "#15803D",
  "blue-100": "#DBEAFE", "blue-700": "#1D4ED8",
  "amber-100": "#FEF3C7", "amber-700": "#B45309",
  "red-100": "#FEE2E2", "red-700": "#B91C1C",
};

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

  it("light-mode condition chip classes (item-detail conditionColors) all clear 4.5:1 (operator: tags unreadable in light mode, 2026-09-06)", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/inventory/item-detail.tsx"), "utf8");
    const mapBody = source.match(/const conditionColors[^{]*=\s*\{([\s\S]*?)\n\};/)![1];
    const rows = [...mapBody.matchAll(/(\w+):\s*"bg-(\w+-\d+)\s+text-(\w+-\d+)\s/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, condition, bgShade, fgShade] of rows) {
      const bg = TAILWIND_HEX[bgShade];
      const fg = TAILWIND_HEX[fgShade];
      expect(bg, `${condition}: unknown Tailwind shade ${bgShade}`).toBeDefined();
      expect(fg, `${condition}: unknown Tailwind shade ${fgShade}`).toBeDefined();
      expect(contrast(fg, bg), condition).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("light-mode --accent-warning text clears 4.5:1 on both --background and --surface (operator: tags unreadable in light mode, 2026-09-06)", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const light = css.split(":root.dark")[0];
    const warning = light.match(/--accent-warning:\s*(#[0-9A-Fa-f]{6})/)![1];
    const background = light.match(/--background:\s*(#[0-9A-Fa-f]{6})/)![1];
    const surface = light.match(/--surface:\s*(#[0-9A-Fa-f]{6})/)![1];
    expect(contrast(warning, background), "on --background").toBeGreaterThanOrEqual(4.5);
    expect(contrast(warning, surface), "on --surface").toBeGreaterThanOrEqual(4.5);
  });

  it("dark-mode --accent-warning text is redefined in :root.dark and clears 4.5:1 on dark --background and --surface (operator: light-mode fix regressed dark, 2026-09-08)", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const darkBlock = css.match(/:root\.dark \{([\s\S]*?)\n\}/)![1];
    const warningMatch = darkBlock.match(/--accent-warning:\s*(#[0-9A-Fa-f]{6})/);
    expect(warningMatch, "--accent-warning must be redefined in :root.dark, not inherited from :root").not.toBeNull();
    const warning = warningMatch![1];
    const background = darkBlock.match(/--background:\s*(#[0-9A-Fa-f]{6})/)![1];
    const surface = darkBlock.match(/--surface:\s*(#[0-9A-Fa-f]{6})/)![1];
    expect(contrast(warning, background), "on dark --background").toBeGreaterThanOrEqual(4.5);
    expect(contrast(warning, surface), "on dark --surface").toBeGreaterThanOrEqual(4.5);
  });
});
