/**
 * eBay Marketplace Account Deletion / Closure notifications — PUBLIC endpoint
 * (mounted in app.ts BEFORE express.json and without requireAuth; eBay calls
 * it unauthenticated). Compliance-mandatory for the production keyset.
 *
 *   GET  ?challenge_code=…  → 200 {challengeResponse}   (endpoint validation)
 *   POST <notification>     → 204 after synchronous anonymization
 *                             412 invalid/missing signature (no processing)
 *                             503 public key unavailable  (eBay retries)
 *                             500 DB failure               (eBay retries)
 *
 * Reference: developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion
 * (read 2026-08-19): unacked notifications are resent until acknowledged;
 * 24h unacked ⇒ endpoint marked down; 30 days ⇒ non-compliant.
 */
import express, { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../../lib/env.js';
import { createLogger } from '../../lib/logger.js';
import { ebayDeletionNotifications } from '../../lib/metrics.js';
import { challengeResponse, verifyNotificationSignature } from '../../marketplace/ebay-notification-verify.js';
import { anonymizeEbayIdentity, type EbayDeletionData } from '../../marketplace/ebay-deletion-anonymize.js';

interface EbayNotification {
  metadata?: { topic?: string };
  notification?: { notificationId?: string; data?: EbayDeletionData };
}

const logger = createLogger('ebay-account-deletion');

export const ebayDeletionRouter = Router();

// Two-tier limiter (same shape as /auth/session, PR #263):
//  tier 1 — raw socket ip. Through the tunnel every caller shares cloudflared's
//           ip, so this only bounds the LAN-reachable :8016 surface (where the
//           CF header can be forged) — hence the generous cap.
//  tier 2 — CF-Connecting-IP (set by Cloudflare at the edge, unforgeable via
//           the tunnel). eBay's own bursts are ≤1500/day (guide), so 60/min
//           is ample headroom while blocking a single-source flood.
const ipTierLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
const edgeTierLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req: Request) => {
    const edge = req.headers['cf-connecting-ip'];
    const ip = typeof edge === 'string' && edge.length > 0 ? edge : req.ip;
    return ip ? ipKeyGenerator(ip) : 'unknown';
  },
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
ebayDeletionRouter.use(ipTierLimiter, edgeTierLimiter);

ebayDeletionRouter.get('/', (req: Request, res: Response) => {
  const code = req.query.challenge_code;
  if (typeof code !== 'string' || code.length === 0) {
    res.status(400).json({ error: 'challenge_code is required', code: 'CHALLENGE_CODE_REQUIRED' });
    return;
  }
  const config = env();
  if (!config.EBAY_DELETION_VERIFICATION_TOKEN || !config.EBAY_DELETION_ENDPOINT_URL) {
    logger.error('eBay deletion endpoint not configured (EBAY_DELETION_VERIFICATION_TOKEN / EBAY_DELETION_ENDPOINT_URL)');
    res.status(503).json({ error: 'deletion endpoint not configured', code: 'NOT_CONFIGURED' });
    return;
  }
  res.status(200).json({
    challengeResponse: challengeResponse(code, config.EBAY_DELETION_VERIFICATION_TOKEN, config.EBAY_DELETION_ENDPOINT_URL),
  });
});

ebayDeletionRouter.post(
  '/',
  // Raw body: the signature is computed over the bytes eBay sent. Content-type
  // agnostic so the 100kb cap cannot be sidestepped by relabeling the body.
  express.raw({ type: () => true, limit: '100kb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const header = req.headers['x-ebay-signature'];
      const verdict = await verifyNotificationSignature(raw, typeof header === 'string' ? header : undefined);
      if (verdict === 'invalid') {
        ebayDeletionNotifications.inc({ result: 'invalid_sig' });
        logger.warn({ bytes: raw.length }, 'eBay deletion notification rejected: invalid or missing signature');
        res.status(412).json({ error: 'signature verification failed', code: 'INVALID_SIGNATURE' });
        return;
      }
      if (verdict === 'key_unavailable') {
        ebayDeletionNotifications.inc({ result: 'key_unavailable' });
        logger.warn('eBay deletion notification: public key unavailable — answering 503 so eBay retries');
        res.status(503).json({ error: 'signature key unavailable, retry', code: 'KEY_UNAVAILABLE' });
        return;
      }

      // Verifier already proved the body parses (else 'invalid').
      const body = JSON.parse(raw.toString('utf8')) as EbayNotification;
      const notificationId = body.notification?.notificationId ?? 'unknown';
      const topic = body.metadata?.topic;
      if (topic !== 'MARKETPLACE_ACCOUNT_DELETION') {
        // Ack-and-ignore keeps the endpoint compliant if eBay ever routes
        // another topic here; nothing is stored.
        ebayDeletionNotifications.inc({ result: 'ignored_topic' });
        logger.info({ notificationId, topic }, 'eBay notification topic ignored');
        res.status(204).end();
        return;
      }

      // Synchronous on purpose: eBay resends until it gets a 2xx, so a DB
      // failure here surfaces as 500 and the notification is redelivered —
      // no fire-and-forget job that a restart could silently drop.
      try {
        const { outcome, counts } = await anonymizeEbayIdentity(body.notification?.data ?? {}, notificationId);
        ebayDeletionNotifications.inc({ result: outcome });
        logger.info({ notificationId, outcome, counts }, 'eBay account-deletion notification processed');
      } catch (err) {
        // anonymizeEbayIdentity already logged the full error + wrote the
        // failed-attempt audit row; count and let the app errorHandler 500.
        ebayDeletionNotifications.inc({ result: 'db_error' });
        throw err;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// body-parser errors (entity.too.large etc.) carry a status; the app-level
// errorHandler only maps AppError/ZodError and would turn them into 500.
ebayDeletionRouter.use((err: Error & { status?: number; type?: string }, req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    ebayDeletionNotifications.inc({ result: 'payload_too_large' });
    logger.warn({ ip: req.ip, edgeIp: req.headers['cf-connecting-ip'], contentLength: req.headers['content-length'] }, 'eBay deletion endpoint: payload over 100kb rejected');
    res.status(413).json({ error: 'payload too large', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }
  next(err);
});
