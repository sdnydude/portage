export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://portage-api.digitalharmonyai.com";

const TOKEN_KEY = "portage_token";
const REFRESH_KEY = "portage_refresh";
const USER_KEY = "portage_user";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
}

let _onTokenRefreshed: ((token: string, refreshToken: string, user: unknown) => void) | null = null;

export function setOnTokenRefreshed(cb: typeof _onTokenRefreshed) {
  _onTokenRefreshed = cb;
}

let _refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error("No refresh token");

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    _onTokenRefreshed?.(null as unknown as string, "", null);
    throw new Error("Refresh failed");
  }

  const data = await response.json() as { token: string; refreshToken: string; user: unknown };
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  _onTokenRefreshed?.(data.token, data.refreshToken, data.user);

  return data.token;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders as Record<string, string>,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && token && path !== "/auth/refresh") {
    let newToken: string;
    try {
      if (!_refreshPromise) {
        _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
      }
      newToken = await _refreshPromise;
    } catch {
      const data = await response.json().catch(() => ({ error: "Session expired", code: "UNAUTHORIZED" }));
      throw new ApiError(401, data.code, data.error, data.details);
    }

    const retryResponse = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!retryResponse.ok) {
      const data = await retryResponse.json().catch(() => ({ error: "Unknown error", code: "UNKNOWN" }));
      throw new ApiError(retryResponse.status, data.code, data.error, data.details);
    }

    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Unknown error", code: "UNKNOWN" }));
    throw new ApiError(response.status, data.code, data.error, data.details);
  }

  return response.json() as Promise<T>;
}
