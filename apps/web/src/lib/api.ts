const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://10.0.0.251:8016";

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

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Unknown error", code: "UNKNOWN" }));
    throw new ApiError(response.status, data.code, data.error, data.details);
  }

  return response.json() as Promise<T>;
}
