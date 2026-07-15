import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TutorialsHubPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

describe("Tutorials hub", () => {
  it("renders a card linking to every tutorial topic", () => {
    render(<TutorialsHubPage />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    for (const slug of ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"]) {
      expect(hrefs).toContain(`/tutorials/${slug}`);
    }
  });

  it("Replay intro mounts the onboarding carousel without completing onboarding", async () => {
    const user = userEvent.setup();
    render(<TutorialsHubPage />);
    await user.click(screen.getByRole("button", { name: "Replay intro" }));
    expect(screen.getByRole("dialog", { name: "Portage onboarding" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip onboarding" }));
    expect(screen.queryByRole("dialog", { name: "Portage onboarding" })).not.toBeInTheDocument();
  });
});
