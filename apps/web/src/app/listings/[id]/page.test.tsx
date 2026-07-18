import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const apiMock = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: (...args: unknown[]) => apiMock(...args),
}));
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "l1" }),
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "t", isAuthenticated: true }),
}));

import ListingRedirect from "./page";

beforeEach(() => {
  apiMock.mockReset();
  replaceMock.mockReset();
});

describe("listings/[id] — resolver redirect (page retired, listing-hub Task 4)", () => {
  it("resolves the listing and redirects to the item hub deep link", async () => {
    apiMock.mockResolvedValue({ id: "l1", itemId: "i1" });
    render(<ListingRedirect />);
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/inventory/i1?listing=l1"),
    );
  });

  it("bounces to the listings tab when the listing can't be resolved", async () => {
    apiMock.mockRejectedValue(new Error("404"));
    render(<ListingRedirect />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/listings"));
  });
});
