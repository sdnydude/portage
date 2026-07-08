import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Cloudflare Access is the identity layer. Against the LAN dev API there is no
// CF edge, so the API's dev bypass (CF_ACCESS_DEV_EMAIL, NODE_ENV=development)
// authenticates GET /auth/session without an assertion header. Against a
// CF-fronted API, set E2E_CF_CLIENT_ID/SECRET to use an Access service token.
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

export const STORAGE_STATE = path.join(__dirname, ".auth", "user.json");

setup("authenticate once for the whole run", async ({ request, baseURL }) => {
  const headers: Record<string, string> = {};
  if (process.env.E2E_CF_CLIENT_ID && process.env.E2E_CF_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.E2E_CF_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.E2E_CF_CLIENT_SECRET;
  }

  const res = await request.get(`${API_BASE}/auth/session`, { headers });
  expect(res.ok(), `session exchange failed: ${res.status()}`).toBeTruthy();
  const data = await res.json();

  const origin = new URL(baseURL!).origin;
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  fs.writeFileSync(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin,
          localStorage: [
            { name: "portage_token", value: data.token },
            { name: "portage_user", value: JSON.stringify(data.user) },
          ],
        },
      ],
    }),
  );
});
