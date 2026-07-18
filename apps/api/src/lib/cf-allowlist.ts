import { env } from './env.js';

// Manages the Cloudflare Access email allowlist that gates Portage. The
// allowlist lives as the `allow`-decision policy on each Access application
// (web app + API hostname); reads use the first app, writes fan out to all.

const CF_API = 'https://api.cloudflare.com/client/v4';

interface AccessPolicy {
  id: string;
  name: string;
  decision: string;
  include: Array<{ email?: { email: string } }>;
}

function cfConfig() {
  const token = env().CF_API_TOKEN;
  const accountId = env().CF_ACCOUNT_ID;
  const appIds = (env().CF_ACCESS_APP_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !accountId || appIds.length === 0) {
    throw new Error('CF_API_TOKEN, CF_ACCOUNT_ID and CF_ACCESS_APP_IDS must be configured');
  }
  return { token, accountId, appIds };
}

async function cfFetch(path: string, init?: RequestInit): Promise<any> {
  const { token } = cfConfig();
  const response = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(() => null) as { success?: boolean; errors?: unknown; result?: unknown } | null;
  if (!response.ok || !data?.success) {
    throw new Error(`Cloudflare API error (${response.status}): ${JSON.stringify(data?.errors ?? null)}`);
  }
  return data;
}

async function getAllowPolicy(appId: string): Promise<AccessPolicy> {
  const { accountId } = cfConfig();
  const data = await cfFetch(`/accounts/${accountId}/access/apps/${appId}/policies`);
  const policy = (data.result as AccessPolicy[]).find((p) => p.decision === 'allow');
  if (!policy) {
    throw new Error(`No allow policy on Access app ${appId} — has the cutover flip run?`);
  }
  return policy;
}

export async function getAllowlist(): Promise<string[]> {
  const { appIds } = cfConfig();
  const policy = await getAllowPolicy(appIds[0]);
  return policy.include
    .map((rule) => rule.email?.email)
    .filter((e): e is string => typeof e === 'string');
}

async function putAllowlist(emails: string[]): Promise<void> {
  const { accountId, appIds } = cfConfig();
  for (const appId of appIds) {
    const policy = await getAllowPolicy(appId);
    await cfFetch(`/accounts/${accountId}/access/apps/${appId}/policies/${policy.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: policy.name,
        decision: 'allow',
        include: emails.map((email) => ({ email: { email } })),
      }),
    });
  }
}

export async function addEmail(email: string): Promise<string[]> {
  const normalized = email.toLowerCase().trim();
  const current = await getAllowlist();
  if (current.some((e) => e.toLowerCase() === normalized)) return current;
  const next = [...current, normalized];
  await putAllowlist(next);
  return next;
}

export async function removeEmail(email: string): Promise<string[]> {
  const normalized = email.toLowerCase().trim();
  const current = await getAllowlist();
  const next = current.filter((e) => e.toLowerCase() !== normalized);
  if (next.length === current.length) return current;
  await putAllowlist(next);
  return next;
}
