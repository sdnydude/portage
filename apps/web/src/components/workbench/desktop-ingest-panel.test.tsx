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
});
