import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Suspense } from "react";
import AdminUserDetailPage from "./page";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));
const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: apiMock, ApiError: class extends Error {} }));
const adminApiMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-admin", () => ({ useAdminApi: adminApiMock }));

const USER = {
  id: "u-1", email: "tess@x.com", displayName: "Tess", role: "user",
  subscriptionTier: "free", aiScansThisMonth: 3, aiListingsThisMonth: 1,
  aiListingCredits: 0, bgRemovalsThisMonth: 0, trialEndsAt: null,
  limitOverrides: null, stripeSubscriptionId: null,
  onboardingCompleted: true, disabledAt: null, disabledReason: null,
  lastActiveAt: null, createdAt: "2026-06-01T00:00:00Z",
  itemCount: 2, listingCount: 1, orderCount: 0, conversationCount: 0,
  totalRevenue: 0, marketplaceConnections: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  adminApiMock.mockReturnValue({ data: USER, isLoading: false, refetch: vi.fn() });
  apiMock.mockResolvedValue({ ok: true });
});

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <AdminUserDetailPage params={Promise.resolve({ id: "u-1" })} />
      </Suspense>,
    );
  });
}

describe("AdminUserDetailPage — edit panel", () => {
  it("edits scan override + credits + trial and saves them in one PATCH", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/AI scans \/ month override/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Listing credits/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Trial ends/i), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/admin/users/u-1", expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({
          aiListingCredits: 5,
          limitOverrides: expect.objectContaining({ aiScansPerMonth: 100 }),
          trialEndsAt: expect.stringContaining("2026-08-01"),
        }),
      }));
    });
  });
});

describe("AdminUserDetailPage — override preservation", () => {
  it("keeps override keys the form does not show (porter/marketplaces) on save", async () => {
    adminApiMock.mockReturnValue({
      data: {
        ...USER,
        // An admin previously set a porter override + unlimited marketplaces.
        limitOverrides: { porterExchangesPerDay: 50, marketplaces: null, aiScansPerMonth: 40 },
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/AI scans \/ month override/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/admin/users/u-1", expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({
          // Full-object replace on the backend: unshown keys must ride along
          // or this save silently deletes them.
          limitOverrides: expect.objectContaining({
            aiScansPerMonth: 100,
            porterExchangesPerDay: 50,
            marketplaces: null,
          }),
        }),
      }));
    });
  });
});
