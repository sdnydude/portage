import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/tutorials/setup",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "s@x.com" } }),
}));

import TutorialTopicPage from "./page";

describe("/tutorials/[topic] — header cluster", () => {
  it("carries the theme toggle and user menu", async () => {
    render(await TutorialTopicPage({ params: Promise.resolve({ topic: "setup" }) }));
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("/tutorials/[topic]", () => {
  it("renders the player for a known slug and 404s an unknown one", async () => {
    render(await TutorialTopicPage({ params: Promise.resolve({ topic: "setup" }) }));
    expect(screen.getByRole("heading", { name: "Get Set Up" })).toBeInTheDocument();

    await expect(
      TutorialTopicPage({ params: Promise.resolve({ topic: "bogus" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
