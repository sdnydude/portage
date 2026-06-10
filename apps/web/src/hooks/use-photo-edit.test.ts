import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  apiMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: h.apiMock,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isAuthenticated: true, token: "t" }) }));

import { usePhotoEdit } from "./use-photo-edit";

const photos = [
  { url: "https://example.com/1.jpg", key: "k1" },
  { url: "https://example.com/2.jpg", key: "k2" },
];

beforeEach(() => {
  h.apiMock.mockReset();
});

describe("usePhotoEdit", () => {
  it("rotate posts /images/rotate for the photo being edited and reports the update", async () => {
    const onPhotoUpdated = vi.fn();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k2-rot", url: "https://example.com/2-rot.jpg", width: 800, height: 600 },
    });
    const { result } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    act(() => result.current.openEditor(1));
    await act(() => result.current.rotate());

    expect(h.apiMock).toHaveBeenCalledWith("/images/rotate", expect.objectContaining({
      method: "POST",
      body: { imageUrl: "https://example.com/2.jpg", degrees: 90 },
    }));
    await waitFor(() =>
      expect(onPhotoUpdated).toHaveBeenCalledWith(1, {
        url: "https://example.com/2-rot.jpg", key: "k2-rot", width: 800, height: 600,
      }),
    );
  });

  it("editingIndex is React state (survives re-render), rotate sends the auth token, closeEditor resets", async () => {
    const onPhotoUpdated = vi.fn();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-rot", url: "https://example.com/1-rot.jpg", width: 10, height: 10 },
    });
    const { result, rerender } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    expect(result.current.editingIndex).toBeNull();
    act(() => result.current.openEditor(0));
    rerender();
    expect(result.current.editingIndex).toBe(0);

    await act(() => result.current.rotate());
    expect(h.apiMock).toHaveBeenCalledWith("/images/rotate", expect.objectContaining({ token: "t" }));

    act(() => result.current.closeEditor());
    expect(result.current.editingIndex).toBeNull();
  });

  it("applyCrop posts /images/crop for the edited photo, reports the update, and closes the crop overlay", async () => {
    const onPhotoUpdated = vi.fn();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-crop", url: "https://example.com/1-crop.jpg", width: 30, height: 40 },
    });
    const { result } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    act(() => result.current.openEditor(0));
    act(() => result.current.openCrop());
    expect(result.current.showCrop).toBe(true);

    await act(() => result.current.applyCrop({ x: 1, y: 2, width: 30, height: 40 }));

    expect(h.apiMock).toHaveBeenCalledWith("/images/crop", expect.objectContaining({
      method: "POST",
      body: { imageUrl: "https://example.com/1.jpg", crop: { x: 1, y: 2, width: 30, height: 40 } },
      token: "t",
    }));
    expect(onPhotoUpdated).toHaveBeenCalledWith(0, {
      url: "https://example.com/1-crop.jpg", key: "k1-crop", width: 30, height: 40,
    });
    expect(result.current.showCrop).toBe(false);

    act(() => result.current.openCrop());
    act(() => result.current.cancelCrop());
    expect(result.current.showCrop).toBe(false);
  });

  it("enhance produces a pendingPreview; accepting reports the update and clears the preview", async () => {
    const onPhotoUpdated = vi.fn();
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-enh", url: "https://example.com/1-enh.jpg", width: 50, height: 60, size: 123 },
    });
    const { result } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    act(() => result.current.openEditor(0));
    await act(() => result.current.enhanceCurrent());

    expect(h.apiMock).toHaveBeenCalledWith("/images/enhance", expect.objectContaining({
      method: "POST",
      body: { imageUrl: "https://example.com/1.jpg" },
    }));
    expect(result.current.pendingPreview).toMatchObject({
      beforeUrl: "https://example.com/1.jpg",
      afterUrl: "https://example.com/1-enh.jpg",
    });

    await act(() => result.current.pendingPreview!.onAccept());
    expect(onPhotoUpdated).toHaveBeenCalledWith(0, {
      url: "https://example.com/1-enh.jpg", key: "k1-enh", width: 50, height: 60,
    });
    expect(result.current.pendingPreview).toBeNull();
  });

  it("bg removal produces a pendingPreview; closing the editor discards it without persisting", async () => {
    const onPhotoUpdated = vi.fn();
    // useBgRemoval first posts the usage event, then the removal itself.
    h.apiMock.mockResolvedValueOnce({});
    h.apiMock.mockResolvedValueOnce({
      image: { key: "k1-bg", url: "https://example.com/1-bg.png", size: 99 },
    });
    const { result } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    act(() => result.current.openEditor(0));
    await act(() => result.current.bgRemoveCurrent());

    expect(h.apiMock).toHaveBeenCalledWith("/images/remove-bg", expect.objectContaining({
      method: "POST",
      body: { imageUrl: "https://example.com/1.jpg" },
    }));
    expect(result.current.pendingPreview).toMatchObject({
      beforeUrl: "https://example.com/1.jpg",
      afterUrl: "https://example.com/1-bg.png",
    });

    act(() => result.current.closeEditor());
    expect(result.current.editingIndex).toBeNull();
    expect(result.current.pendingPreview).toBeNull();
    expect(onPhotoUpdated).not.toHaveBeenCalled();
  });

  it("rotate and crop failures surface in error without persisting", async () => {
    const onPhotoUpdated = vi.fn();
    h.apiMock.mockRejectedValueOnce(new Error("rotate exploded"));
    const { result } = renderHook(() => usePhotoEdit(photos, onPhotoUpdated));

    act(() => result.current.openEditor(0));
    await act(() => result.current.rotate());
    expect(result.current.error).toBe("rotate exploded");
    expect(onPhotoUpdated).not.toHaveBeenCalled();

    h.apiMock.mockRejectedValueOnce(new Error("crop exploded"));
    act(() => result.current.openCrop());
    await act(() => result.current.applyCrop({ x: 0, y: 0, width: 1, height: 1 }));
    expect(result.current.error).toBe("crop exploded");
    expect(result.current.showCrop).toBe(false);
    expect(onPhotoUpdated).not.toHaveBeenCalled();
  });
});
