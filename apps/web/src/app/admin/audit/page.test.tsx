import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminAuditPage from "./page";

const adminApiMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-admin", () => ({ useAdminApi: adminApiMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminAuditPage — system-actor rows", () => {
  it("renders an eBay account-deletion audit row (admin_user_id NULL) as actor 'System' with a readable action label", () => {
    adminApiMock.mockReturnValue({
      data: {
        entries: [{
          id: "a1",
          adminUserId: null,
          adminEmail: null,
          action: "ebay_account_deletion",
          targetType: "ebay_identity",
          targetId: null,
          details: { status: "ok", notificationId: "n-1" },
          createdAt: "2026-08-19T00:00:00Z",
        }],
        total: 1,
        limit: 30,
      },
      isLoading: false,
    });

    render(<AdminAuditPage />);

    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("eBay Account Deletion")).toBeInTheDocument();
  });

  it("renders the joined admin email for human-actor rows, falling back to the id prefix when the join yields nothing", () => {
    adminApiMock.mockReturnValue({
      data: {
        entries: [
          { id: "b1", adminUserId: "8d1c2e3f-0000-0000-0000-000000000000", adminEmail: "admin@x.com", action: "user_role_changed", targetType: "user", targetId: null, details: null, createdAt: "2026-08-19T00:00:00Z" },
          { id: "b2", adminUserId: "9e9e9e9e-0000-0000-0000-000000000000", adminEmail: null, action: "user_disabled", targetType: "user", targetId: null, details: null, createdAt: "2026-08-19T00:00:00Z" },
        ],
        total: 2,
        limit: 30,
      },
      isLoading: false,
    });

    render(<AdminAuditPage />);

    expect(screen.getByText("admin@x.com")).toBeInTheDocument();
    expect(screen.getByText("9e9e9e9e")).toBeInTheDocument();
  });
});
