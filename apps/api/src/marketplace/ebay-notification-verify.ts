/**
 * eBay Marketplace Account Deletion — endpoint validation + notification
 * signature verification.
 *
 * Scheme (eBay guide "Marketplace User Account Deletion" + official
 * event-notification-nodejs-sdk v1.0.3, test vector verified locally):
 *   - Challenge: sha256hex(challengeCode + verificationToken + endpoint).
 *   - Notification: header `x-ebay-signature` = base64(JSON {alg:"ecdsa", kid,
 *     signature: base64 DER, digest:"SHA1"}); ECDSA-SHA1 over the JSON body.
 *     Public key from GET /commerce/notification/v1/public_key/{kid} with an
 *     app token; response {key: PEM w/o newlines, algorithm, digest}.
 */
import { createHash, createVerify } from 'node:crypto';
import { getEbayProdAppToken } from './token-manager.js';
import { EBAY_USER_AGENT } from './ebay-constants.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('ebay-notification-verify');

// Deletion notifications only ever fire against the PRODUCTION keyset, so the
// public key always comes from prod regardless of EBAY_SANDBOX (same
// prod-force pattern as Taxonomy/Browse: getEbayProdAppToken).
const PUBLIC_KEY_URL = 'https://api.ebay.com/commerce/notification/v1/public_key/';
// eBay guide: "cached for a temporary — but reasonable — amount of time (e.g.,
// one-hour is recommended)".
const KEY_TTL_MS = 60 * 60_000;
// Failed lookups (unknown kid / eBay 5xx) are remembered briefly so a flood of
// bogus kids cannot turn every request into an outbound eBay call.
const NEGATIVE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 32;
// Hard cap on NEW-kid fetches per minute, independent of the HTTP rate
// limiter (which is IP-keyed and spoof-sensitive on the LAN). Legit key
// rotation is rare; 10/min is generous.
const NEW_KID_FETCHES_PER_MINUTE = 10;
// kid is attacker-controlled (unauthenticated header) and interpolated into a
// URL: allow only UUID-shaped values (eBay kids are UUIDs, e.g. SDK vectors).
const KID_RE = /^[0-9a-f-]{36}$/i;

interface KeyCacheEntry { pem?: string; at: number }
const keyCache = new Map<string, KeyCacheEntry>();
let fetchWindow = { start: 0, count: 0 };

export function _resetEbayNotificationKeyCache(): void {
  keyCache.clear();
  fetchWindow = { start: 0, count: 0 };
}

export class PublicKeyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicKeyUnavailableError';
  }
}

/** eBay returns the PEM on one line; Node's key parser needs the newlines. */
export function formatEbayPem(key: string): string {
  return key
    .replace(/-----BEGIN PUBLIC KEY-----\s*/, '-----BEGIN PUBLIC KEY-----\n')
    .replace(/\s*-----END PUBLIC KEY-----/, '\n-----END PUBLIC KEY-----');
}

function cacheSet(kid: string, entry: KeyCacheEntry): void {
  if (keyCache.size >= CACHE_MAX && !keyCache.has(kid)) {
    const oldest = keyCache.keys().next().value;
    if (oldest !== undefined) keyCache.delete(oldest);
  }
  keyCache.set(kid, entry);
}

function takeFetchSlot(now: number): boolean {
  if (now - fetchWindow.start >= 60_000) fetchWindow = { start: now, count: 0 };
  if (fetchWindow.count >= NEW_KID_FETCHES_PER_MINUTE) return false;
  fetchWindow.count += 1;
  return true;
}

/**
 * Public key for a signature kid — 1h positive cache, 5m negative cache,
 * bounded map, bounded new-kid fetch rate. Throws PublicKeyUnavailableError
 * when the key cannot be obtained right now (caller answers 503 → eBay retries).
 */
export async function getEbayNotificationPublicKey(kid: string): Promise<string> {
  const now = Date.now();
  const cached = keyCache.get(kid);
  if (cached) {
    if (cached.pem && now - cached.at < KEY_TTL_MS) return cached.pem;
    if (!cached.pem && now - cached.at < NEGATIVE_TTL_MS) {
      logger.warn({ kid, failedAgoMs: now - cached.at }, 'eBay notification public key: negative-cache hit, not refetching yet');
      throw new PublicKeyUnavailableError(`public key ${kid} recently failed to load`);
    }
  }
  if (!takeFetchSlot(now)) {
    logger.warn({ kid, perMinute: NEW_KID_FETCHES_PER_MINUTE }, 'eBay notification public key: new-kid fetch cap hit — possible kid flood or key-rotation storm');
    throw new PublicKeyUnavailableError('new-kid public key fetch rate exceeded');
  }
  try {
    const token = await getEbayProdAppToken();
    const response = await fetch(`${PUBLIC_KEY_URL}${kid}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': EBAY_USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`eBay public_key/${kid} returned ${response.status}`);
    }
    const body = (await response.json()) as { key?: unknown };
    if (typeof body.key !== 'string' || !body.key.includes('BEGIN PUBLIC KEY')) {
      throw new Error(`eBay public_key/${kid} response missing PEM key`);
    }
    const pem = formatEbayPem(body.key);
    cacheSet(kid, { pem, at: now });
    return pem;
  } catch (err) {
    cacheSet(kid, { at: now });
    logger.warn({ kid, err }, 'eBay notification public key fetch failed (app token, eBay HTTP, or PEM parse)');
    throw new PublicKeyUnavailableError((err as Error).message);
  }
}

export type SignatureVerdict = 'ok' | 'invalid' | 'key_unavailable';

/**
 * Verify `x-ebay-signature` over the request body.
 *
 * eBay's SDK verifies `JSON.stringify(parsedBody)` (re-serialized), so we try
 * the raw bytes first (cheapest, exact) and fall back to the SDK-canonical
 * form. Malformed JSON, bad header, wrong alg/digest, or a non-verifying
 * signature ⇒ 'invalid' (412). Key fetch trouble ⇒ 'key_unavailable' (503).
 */
export async function verifyNotificationSignature(rawBody: Buffer, header: string | undefined): Promise<SignatureVerdict> {
  const invalid = (reason: string, extra: Record<string, unknown> = {}): 'invalid' => {
    // debug, not warn: unauthenticated path, expected to see probe noise.
    logger.debug({ reason, ...extra }, 'eBay notification signature invalid');
    return 'invalid';
  };
  const sig = parseSignatureHeader(header);
  if (!sig) return invalid(header ? 'header_unparseable' : 'header_missing');
  if (sig.alg !== undefined && sig.alg.toLowerCase() !== 'ecdsa') return invalid('alg_mismatch', { alg: sig.alg });
  if (sig.digest !== undefined && sig.digest.toUpperCase() !== 'SHA1') return invalid('digest_mismatch', { digest: sig.digest });
  if (!KID_RE.test(sig.kid)) return invalid('kid_shape', { kid: sig.kid.slice(0, 64) });

  let canonical: string;
  try {
    canonical = JSON.stringify(JSON.parse(rawBody.toString('utf8')));
  } catch {
    return invalid('body_not_json', { bytes: rawBody.length });
  }

  let pem: string;
  try {
    pem = await getEbayNotificationPublicKey(sig.kid);
  } catch {
    return 'key_unavailable';
  }

  const verifies = (data: Buffer | string): boolean => {
    try {
      return createVerify('sha1').update(data).verify(pem, sig.signature, 'base64');
    } catch (err) {
      // A THROW here (bad PEM shape, unsupported curve, malformed base64) is a
      // different failure class from a clean non-match — surface it at warn so
      // a key-format regression does not hide inside probe-noise 412s.
      logger.warn({ kid: sig.kid, err }, 'eBay notification signature verify THREW (not a mismatch)');
      return false;
    }
  };
  if (verifies(rawBody) || verifies(canonical)) return 'ok';
  return invalid('signature_mismatch', { kid: sig.kid });
}

export interface EbaySignatureHeader {
  alg?: string;
  kid: string;
  signature: string;
  digest?: string;
}

/**
 * Decode `x-ebay-signature` (base64 JSON). Returns null on any malformed
 * input — the caller treats null as an invalid signature (412), never a 500.
 */
export function parseSignatureHeader(header: string | undefined): EbaySignatureHeader | null {
  if (typeof header !== 'string' || !header) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const { alg, kid, signature, digest } = parsed as Record<string, unknown>;
    if (typeof kid !== 'string' || typeof signature !== 'string') return null;
    return {
      kid,
      signature,
      ...(typeof alg === 'string' ? { alg } : {}),
      ...(typeof digest === 'string' ? { digest } : {}),
    };
  } catch {
    return null;
  }
}

export function challengeResponse(challengeCode: string, verificationToken: string, endpoint: string): string {
  return createHash('sha256')
    .update(challengeCode)
    .update(verificationToken)
    .update(endpoint)
    .digest('hex');
}
