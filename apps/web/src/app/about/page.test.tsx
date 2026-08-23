import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "./page";

describe("AboutPage (P4 — linked from the publish disclaimer + avatar menu + More)", () => {
  it("renders the six sections and links to the full Terms and Privacy pages", () => {
    render(<AboutPage />);
    for (const name of ["About Portage", "AI suggestions", "Beta terms", "Liability waiver", "Privacy and full terms", "Contact"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByRole("main")).toHaveClass("compact-bar-clearance");
  });
});
