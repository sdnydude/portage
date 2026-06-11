import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// The API's auth limiter is 10-in-15min: per-test logins burn 7 of those per
// suite run and made consecutive runs flaky. This setup project logs in ONCE
// via the API and persists the session (localStorage tokens) for every test.
const EMAIL = process.env.E2E_EMAIL ?? "demo@portage.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "demo1234demo1234";
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

export const STORAGE_STATE = path.join(__dirname, ".auth", "user.json");

setup("authenticate once for the whole run", async ({ request, baseURL }) => {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
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
            { name: "portage_refresh", value: data.refreshToken },
            { name: "portage_user", value: JSON.stringify(data.user) },
          ],
        },
      ],
    }),
  );
});
