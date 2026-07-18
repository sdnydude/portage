import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoggedOutHero } from "./logged-out-hero";

describe("LoggedOutHero", () => {
  it("Get Started is a full-page navigation to /home so the Cloudflare edge can run its login", () => {
    // The old CTA was <Link href="/"> — a client-side hop to a redirect back
    // to /home that never left the SPA, so it could never trigger a CF Access
    // login (dead button, live 2026-07-10). CF logs a user in by intercepting
    // a full document request at the edge; the CTA must force one.
    const { getByRole } = render(<LoggedOutHero />);
    const cta = getByRole("link", { name: /get started/i });
    expect(cta.getAttribute("href")).toBe("/home");
    // Plain anchor, not next/link: next/link intercepts the click client-side
    // and the request never reaches the edge.
    expect(cta.getAttribute("data-full-navigation")).toBe("true");
  });
});
