import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminUsersPage from "./page";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: apiMock, ApiError: class extends Error {} }));
const adminApiMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-admin", () => ({ useAdminApi: adminApiMock }));

beforeEach(() => {
  vi.clearAllMocks();
  adminApiMock.mockReturnValue({
    data: { users: [], total: 0, page: 1, pages: 1 },
    isLoading: false,
    refetch: vi.fn(),
  });
  apiMock.mockResolvedValue({ user: { id: "u-new" }, invited: true });
});

describe("AdminUsersPage — add user", () => {
  it("opens the modal and POSTs email/tier/invite to /admin/users", async () => {
    render(<AdminUsersPage />);

    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@x.com" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "beta-tester" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/admin/users", expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ email: "new@x.com", subscriptionTier: "beta-tester", invite: true }),
      }));
    });
  });
});
