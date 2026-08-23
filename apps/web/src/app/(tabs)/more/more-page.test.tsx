import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { email: "s@x.com", role: "user" }, logout: vi.fn(), token: "t" }) }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 0 }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/more", useRouter: () => ({ push: vi.fn() }) }));

import MorePage from "./page";

describe("MorePage — the mobile path to /about (P4)", () => {
  it("lists an About link next to Help & Support", () => {
    render(<MorePage />);
    expect(screen.getByRole("link", { name: /About/ })).toHaveAttribute("href", "/about");
  });
});
