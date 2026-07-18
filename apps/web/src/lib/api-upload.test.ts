import { describe, it, expect, vi, afterEach } from "vitest";
import { apiUpload } from "./api";

// Multipart uploads used to go through raw fetch calls with a closure token —
// no 401 recovery, so any upload after the 15-min internal JWT expired failed
// outright ("All photos failed to upload", live 2026-07-10: POST /images 401
// jwt-expired during native-camera adds). apiUpload must re-exchange and
// retry exactly like api() does.
describe("apiUpload CF session exchange", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("re-exchanges the CF session on 401 and retries the same FormData with the new token", async () => {
    const fetchMock = vi.fn()
      // original upload: 401 (internal token expired while user was in the camera)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      })
      // GET /auth/session — CF cookie still valid, fresh internal token
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "fresh-token", user: { id: "u1", email: "t@example.com" } }),
      })
      // retried upload
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ image: { key: "k", url: "https://img/x.jpg", width: 1, height: 1 } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("image", new Blob(["x"], { type: "image/jpeg" }), "x.jpg");

    const result = await apiUpload<{ image: { key: string } }>("/images", form, { token: "stale-token" });

    expect(result.image.key).toBe("k");
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/session");
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe("Bearer fresh-token");
    expect(retryInit.body).toBe(form);
  });
});
