import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { rootLogger } from './lib/logger.js';
import { env } from './lib/env.js';
import { httpRequestDuration, httpRequestTotal, metricsRegistry } from './lib/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { imagesRouter } from './routes/images.js';
import { scanRouter } from './routes/scan.js';
import { itemsRouter } from './routes/items.js';
import { usageRouter } from './routes/usage.js';
import { listingsRouter } from './routes/listings.js';
import { ordersRouter } from './routes/orders.js';
import { porterRouter } from './routes/porter.js';
import { dashboardRouter } from './routes/dashboard.js';
import { ebayAuthRouter } from './routes/marketplace/ebay-auth.js';
import { reverbAuthRouter } from './routes/marketplace/reverb-auth.js';
import { ebayDeletionRouter } from './routes/marketplace/ebay-deletion.js';
import { adminRouter } from './routes/admin.js';
import { disclaimerRouter } from './routes/disclaimer.js';
import { faqsRouter } from './routes/faqs.js';
import { surveyRouter } from './routes/survey.js';
import { draftsRouter } from './routes/drafts.js';
import { preferencesRouter } from './routes/preferences.js';
import { sellerProfileRouter } from './routes/seller-profile.js';
import { prepareListingRouter } from './routes/prepare-listing.js';
import { usersRouter } from './routes/users.js';
import { billingRouter, billingWebhookRouter } from './routes/billing.js';
import { messagesRouter } from './routes/messages.js';
import { betaRouter } from './routes/beta.js';
import { syncLogRouter } from './routes/sync-log.js';

export function createApp() {
  const config = env();
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const baseOrigins = config.NODE_ENV === 'production'
    ? ['https://portage.digitalharmonyai.com']
    : ['http://10.0.0.251:3002', 'http://10.0.0.251:3000', 'https://10.0.0.251:3002', 'https://portage.digitalharmonyai.com', 'https://rehearsal.digitalharmonyai.com'];
  // Additive, env-gated extra origins (comma-separated) — used by the ephemeral
  // e2e stack to allow its isolated app port. Unset in prod ⇒ zero change.
  const extraOrigins = (process.env.EXTRA_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({
    origin: [...baseOrigins, ...extraOrigins],
    credentials: true,
  }));

  app.use('/billing', billingWebhookRouter);
  // eBay Marketplace Account Deletion — public, signature-verified, raw body
  // (own 100kb parser), mounted before express.json like the Stripe webhook.
  app.use('/marketplace/ebay/account-deletion', ebayDeletionRouter);
  // The URL must match the eBay portal registration byte-for-byte (it feeds
  // the challenge hash) — surface it in the boot log for live verification.
  rootLogger.info(
    { endpointUrl: config.EBAY_DELETION_ENDPOINT_URL ?? null, tokenConfigured: Boolean(config.EBAY_DELETION_VERIFICATION_TOKEN) },
    'eBay account-deletion endpoint mounted at /marketplace/ebay/account-deletion',
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({ logger: rootLogger }));

  // Prometheus metrics middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      const durationSeconds = (Date.now() - start) / 1000;
      httpRequestDuration.observe(labels, durationSeconds);
      httpRequestTotal.inc(labels);
    });
    next();
  });

  app.get('/metrics', async (req: Request, res: Response, next) => {
    try {
      const secret = config.METRICS_SECRET;
      if (secret) {
        const auth = req.headers.authorization;
        if (!auth || auth !== `Bearer ${secret}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }
      res.set('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } catch (err) {
      next(err);
    }
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/images', imagesRouter);
  app.use('/scan', scanRouter);
  app.use('/items', itemsRouter);
  app.use('/usage', usageRouter);
  app.use('/listings', listingsRouter);
  app.use('/orders', ordersRouter);
  app.use('/porter', porterRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/marketplace/ebay', ebayAuthRouter);
  app.use('/marketplace/reverb', reverbAuthRouter);
  app.use('/admin', adminRouter);
  app.use('/disclaimer', disclaimerRouter);
  app.use('/faqs', faqsRouter);
  app.use('/survey', surveyRouter);
  app.use('/drafts', draftsRouter);
  app.use('/users/me', usersRouter);
  app.use('/users/me/preferences', preferencesRouter);
  app.use('/seller-profile', sellerProfileRouter);
  app.use('/items', prepareListingRouter);
  app.use('/billing', billingRouter);
  app.use('/messages', messagesRouter);
  app.use('/beta', betaRouter);
  app.use('/sync-log', syncLogRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
