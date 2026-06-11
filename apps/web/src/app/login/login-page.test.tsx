import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false }),
}));

const apiMock = vi.fn().mockResolvedValue({
  token: "t",
  refreshToken: "rt",
  user: { id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" },
});
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class extends Error {},
}));

afterEach(() => {
  apiMock.mockClear();
});

describe("LoginPage stay logged in", () => {
  it("sends stayLoggedIn in the login body when the checkbox is checked", async () => {
    const { container } = render(<LoginPage />);

    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "e@x.com" } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "pw" } });
    fireEvent.click(screen.getByLabelText(/stay logged in/i));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    const [, options] = apiMock.mock.calls[0];
    expect((options as { body: { stayLoggedIn?: boolean } }).body.stayLoggedIn).toBe(true);
  });
});
