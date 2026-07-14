import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ apiMock: vi.fn() }));
const camHolder = vi.hoisted(() => ({ props: null as null | { onCapture: (f: File) => void; onClose: () => void } }));
vi.mock("@/components/capture/camera-capture", () => ({
  CameraCapture: (props: { onCapture: (f: File) => void; onClose: () => void }) => {
    camHolder.props = props;
    return <div data-testid="camera-open" />;
  },
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: h.apiMock,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));
vi.mock("@/hooks/use-camera", () => ({
  useCamera: () => ({ videoRef: { current: null }, isReady: false, error: null, start: vi.fn(), stop: vi.fn(), capture: vi.fn(), switchCamera: vi.fn() }),
}));

import { PhotoCaptureFlow } from "./photo-capture-flow";

const photos = [{ url: "https://example.com/1.jpg", key: "k1", thumbnailUrl: "https://example.com/1-t.jpg" }];

describe("PhotoCaptureFlow — unified editor overlay (S2.5-11)", () => {
  it("editing a grid photo opens the shared PhotoEditPanel (not the legacy PhotoEditor)", () => {
    render(
      <PhotoCaptureFlow
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        initialPhotos={photos}
        minPhotos={1}
      />,
    );

    // Grid tiles open the editor on pointer-up (long-press is reorder).
    const tile = screen.getByAltText("Photo 1").parentElement!;
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(tile);
    // Shared panel signature: indexed header + Close editor + all 4 tools.
    expect(screen.getByText(/edit photo 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^crop$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bg remove/i })).toBeInTheDocument();
  });

  it("rotate posts /images/rotate and the grid photo picks up the rotated image", async () => {
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-rot", url: "https://example.com/1-rot.jpg", width: 800, height: 600 },
    });
    render(
      <PhotoCaptureFlow
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        initialPhotos={photos}
        minPhotos={1}
      />,
    );

    fireEvent.pointerDown(screen.getByAltText("Photo 1").parentElement!, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(screen.getByAltText("Photo 1").parentElement!);
    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));

    await waitFor(() => {
      expect(h.apiMock).toHaveBeenCalledWith("/images/rotate", expect.objectContaining({
        method: "POST",
        body: { imageUrl: "https://example.com/1.jpg", degrees: 90 },
      }));
    });

    // The grid thumb must show the rotated image — a stale pre-edit
    // thumbnailUrl may not linger after an edit.
    fireEvent.click(screen.getByRole("button", { name: /close editor/i }));
    await waitFor(() => {
      expect(screen.getByAltText("Photo 1")).toHaveAttribute("src", "https://example.com/1-rot.jpg");
    });
  });
});

describe("PhotoCaptureFlow — multi-shot camera session", () => {
  it("camera stays open across shots; Done lands all photos in the grid", async () => {
    h.apiMock.mockResolvedValue({});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: { url: "https://img/x.jpg", key: "kx", width: 100, height: 100 } }),
    }) as unknown as typeof fetch;

    render(
      <PhotoCaptureFlow onComplete={vi.fn()} onCancel={vi.fn()} initialPhotos={photos} minPhotos={1} />,
    );

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Take Photo"));
    expect(screen.getByTestId("camera-open")).toBeInTheDocument();

    await act(async () => {
      camHolder.props!.onCapture(new File(["a"], "1.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      camHolder.props!.onCapture(new File(["b"], "2.jpg", { type: "image/jpeg" }));
    });
    // Never unmounted between shots — no iOS/macOS permission re-prompt.
    expect(screen.getByTestId("camera-open")).toBeInTheDocument();

    await act(async () => {
      camHolder.props!.onClose();
    });
    // Back in the grid with the two new photos (1 initial + 2 captured).
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });
});
