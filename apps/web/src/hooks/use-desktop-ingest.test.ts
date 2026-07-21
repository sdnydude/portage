import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const apiUploadMock = vi.fn();
const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => apiMock(...a),
  apiUpload: (...a: unknown[]) => apiUploadMock(...a),
  ApiError: class ApiError extends Error {},
  API_BASE: "http://test",
}));
vi.mock("./use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { useDesktopIngest } from "./use-desktop-ingest";

function makeFile(name: string): File {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  apiUploadMock.mockReset();
  apiMock.mockReset();
});

describe("useDesktopIngest", () => {
  it("enqueues one item per file in separate mode", () => {
    apiUploadMock.mockReturnValue(new Promise(() => {})); // freeze at upload
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg"), makeFile("b.jpg")], "separate");
    });

    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].files).toHaveLength(1);
  });

  it("uploads dropped files and records their R2 urls", async () => {
    apiUploadMock.mockResolvedValue({ image: { url: "https://r2/a.jpg" } });
    apiMock.mockResolvedValue({ identification: {}, detailed: {} });
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg")], "separate");
    });

    await waitFor(() =>
      expect(result.current.queue[0].uploadedUrls).toEqual(["https://r2/a.jpg"]),
    );
    expect(apiUploadMock).toHaveBeenCalledWith(
      "/images",
      expect.any(FormData),
      { token: "t" },
    );
  });

  it("identifies the item via /scan/refine and becomes ready", async () => {
    apiUploadMock.mockResolvedValue({ image: { url: "https://r2/a.jpg" } });
    apiMock.mockResolvedValue({
      identification: { name: "Vintage Camera" },
      detailed: { candidates: [{ name: "Vintage Camera" }], reasoning: [] },
    });
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg")], "separate");
    });

    await waitFor(() => expect(result.current.queue[0].status).toBe("ready"));
    expect(result.current.queue[0].fields?.name).toBe("Vintage Camera");
    expect(apiMock).toHaveBeenCalledWith(
      "/scan/refine",
      expect.objectContaining({
        method: "POST",
        body: { imageUrls: ["https://r2/a.jpg"] },
      }),
    );
  });

  it("saves a ready item to /items and marks it saved", async () => {
    apiUploadMock.mockResolvedValue({ image: { url: "https://r2/a.jpg" } });
    apiMock.mockImplementation((path: string) =>
      path === "/scan/refine"
        ? Promise.resolve({
            identification: { name: "Cam" },
            detailed: {
              candidates: [
                {
                  name: "Cam",
                  description: "",
                  category: "",
                  condition: "good",
                  conditionNotes: "",
                  brand: null,
                  model: null,
                  features: [],
                  estimatedValueLow: 0,
                  estimatedValueHigh: 0,
                  confidence: 0,
                },
              ],
              reasoning: [],
            },
          })
        : Promise.resolve({ id: "item-1" }),
    );
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg")], "separate");
    });
    await waitFor(() => expect(result.current.queue[0].status).toBe("ready"));

    await act(async () => {
      await result.current.save(result.current.queue[0].id);
    });

    expect(result.current.queue[0].status).toBe("saved");
    expect(apiMock).toHaveBeenCalledWith(
      "/items",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updateFields merges edits into a ready item's fields", async () => {
    apiUploadMock.mockResolvedValue({ image: { url: "https://r2/a.jpg" } });
    apiMock.mockResolvedValue({
      identification: { name: "Cam" },
      detailed: { candidates: [{ name: "Cam" }], reasoning: [] },
    });
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg")], "separate");
    });
    await waitFor(() => expect(result.current.queue[0].status).toBe("ready"));

    act(() => {
      result.current.updateFields(result.current.queue[0].id, {
        name: "Edited",
      });
    });

    expect(result.current.queue[0].fields?.name).toBe("Edited");
  });

  it("remove drops an item from the queue", () => {
    apiUploadMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDesktopIngest());

    act(() => {
      result.current.addFiles([makeFile("a.jpg"), makeFile("b.jpg")], "separate");
    });
    const firstId = result.current.queue[0].id;

    act(() => {
      result.current.remove(firstId);
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue.find((it) => it.id === firstId)).toBeUndefined();
  });
});
