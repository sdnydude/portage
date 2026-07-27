// Same-origin by default: /backend/* is rewritten by Next to the API container
// (see next.config.ts), so the Cloudflare Access cookie + assertion headers
// ride along on every request without CORS.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

const TOKEN_KEY = "portage_token";
const USER_KEY = "portage_user";

// Dispatched on window when the session is definitively lost (the CF session
// exchange itself was rejected). AuthProvider listens for this.
export const SESSION_LOST_EVENT = "auth:session-lost";

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

let _onSessionExchanged: ((token: string | null, user: unknown) => void) | null = null;

export function setOnSessionExchanged(cb: typeof _onSessionExchanged) {
  _onSessionExchanged = cb;
}

let _exchangePromise: Promise<string> | null = null;

export class SessionLostError extends Error {}

let _exchangeBlockedUntil = 0;
let _exchangeFailures = 0;
let _lastExchangeSuccessAt = 0;

export function _resetExchangeBreakerForTests() {
  _exchangeBlockedUntil = 0;
  _exchangeFailures = 0;
  _lastExchangeSuccessAt = 0;
}

export function requestExchange(): Promise<string> {
  // Success-side throttle: 15-minute tokens make a 10s reuse window safe.
  // Remount storms (hard navigations) reuse the fresh token instead of
  // re-fetching.
  if (Date.now() - _lastExchangeSuccessAt < 10_000) {
    const cached = localStorage.getItem(TOKEN_KEY);
    if (cached) return Promise.resolve(cached);
  }
  if (Date.now() < _exchangeBlockedUntil) {
    return Promise.reject(new Error("Session exchange is cooling down after a failure"));
  }
  if (!_exchangePromise) {
    _exchangePromise = exchangeSession()
      .then((t) => {
        _exchangeFailures = 0;
        _lastExchangeSuccessAt = Date.now();
        return t;
      })
      .catch((err) => {
        if (!(err instanceof SessionLostError)) {
          _exchangeFailures++;
          // 5s → 15s → 45s → 60s cap
          _exchangeBlockedUntil = Date.now() + Math.min(60_000, 5_000 * 3 ** (_exchangeFailures - 1));
        }
        throw err;
      })
      .finally(() => {
        _exchangePromise = null;
      });
  }
  return _exchangePromise;
}

// Exchange the Cloudflare Access identity (cookie/assertion forwarded by the
// edge) for a fresh internal access token. CF is the session layer — there is
// no refresh token; when the internal token expires we just exchange again.
export async function exchangeSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/session`, { cache: "no-store" });

  if (!response.ok) {
    // Only a definitive auth rejection means the session is gone. A 429/5xx is
    // a server hiccup — wiping a valid session for it would log the user out
    // over a transient error.
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      _onSessionExchanged?.(null, null);
      window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT));
      // Definitive loss, already handled above — the breaker must not cool
      // down on it or it would block the next legitimate re-login attempt.
      throw new SessionLostError(`Session exchange failed (${response.status})`);
    }
    throw new Error(`Session exchange failed (${response.status})`);
  }

  const data = await response.json() as { token: string; user: unknown };
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  _onSessionExchanged?.(data.token, data.user);

  return data.token;
}

// Surfaced when a request dies at the network layer (offline, OR a Cloudflare
// Access session expiry: the fetch gets 302'd to the CF login page and CORS
// kills it — the browser only reports "Failed to fetch").
const NETWORK_ERROR_MESSAGE =
  "Couldn't reach Portage — check your connection, or reload the page to sign back in.";

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders as Record<string, string>,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure. If the CF cookie is still good, one session
    // re-exchange + retry recovers a mid-action expiry transparently;
    // otherwise fail with something more actionable than "Failed to fetch".
    try {
      const newToken = await requestExchange();
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
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, "NETWORK", NETWORK_ERROR_MESSAGE);
    }
  }

  if (response.status === 401 && token && path !== "/auth/session") {
    let newToken: string;
    try {
      newToken = await requestExchange();
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

// Multipart uploads. Same 401 → session re-exchange → single retry contract as
// api(), but the browser must set the Content-Type (multipart boundary), so the
// JSON default above can't be reused. FormData bodies are safe to resend.
export async function apiUpload<T>(
  path: string,
  form: FormData,
  options: { token?: string } = {},
): Promise<T> {
  const { token } = options;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  } catch {
    // Same network-level recovery as api() — see NETWORK_ERROR_MESSAGE.
    try {
      const newToken = await requestExchange();
      const retryResponse = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${newToken}` },
        body: form,
      });
      if (!retryResponse.ok) {
        const data = await retryResponse.json().catch(() => ({ error: "Unknown error", code: "UNKNOWN" }));
        throw new ApiError(retryResponse.status, data.code, data.error, data.details);
      }
      return retryResponse.json() as Promise<T>;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, "NETWORK", NETWORK_ERROR_MESSAGE);
    }
  }

  if (response.status === 401 && token) {
    let newToken: string;
    try {
      newToken = await requestExchange();
    } catch {
      const data = await response.json().catch(() => ({ error: "Session expired", code: "UNAUTHORIZED" }));
      throw new ApiError(401, data.code, data.error, data.details);
    }

    const retryResponse = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${newToken}` },
      body: form,
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
