import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const apiUploadMock = vi.fn();
const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => apiMock(...a),
  apiUpload: (...a: unknown[]) => apiUploadMock(...a),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { DesktopIngestPanel } from "./desktop-ingest-panel";

function makeFile(name: string): File {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  apiUploadMock.mockReset();
  apiMock.mockReset();
});

describe("DesktopIngestPanel", () => {
  it("enqueues a card when image files are dropped", async () => {
    apiUploadMock.mockReturnValue(new Promise(() => {})); // freeze at upload
    render(
      <DesktopIngestPanel>
        <div>list</div>
      </DesktopIngestPanel>,
    );

    fireEvent.drop(screen.getByText("list"), {
      dataTransfer: { files: [makeFile("a.jpg")] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("ingest-queue")).toBeInTheDocument(),
    );
  });

  it("reports a successful save upward so the inventory list and category chips refresh (wiring audit)", async () => {
    apiUploadMock.mockResolvedValue({ image: { url: "http://img/1.jpg", key: "k1", width: 10, height: 10 } });
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/scan/refine") {
        return { detailed: { candidates: [{ name: "Dropped Thing", description: "", category: "other", condition: "good", conditionNotes: "", estimatedValueLow: 0, estimatedValueHigh: 0, brand: "", model: "", features: [], confidence: 0.9 }], reasoning: [] } };
      }
      if (path === "/items") return { id: "new-1" };
      return {};
    });
    const onSaved = vi.fn();
    render(
      <DesktopIngestPanel onSaved={onSaved}>
        <div>list</div>
      </DesktopIngestPanel>,
    );
    fireEvent.drop(screen.getByText("list"), { dataTransfer: { files: [makeFile("a.jpg")] } });
    const saveBtn = await screen.findByRole("button", { name: /^save$/i }, { timeout: 5000 });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
