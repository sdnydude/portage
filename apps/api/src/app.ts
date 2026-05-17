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
import { etsyAuthRouter } from './routes/marketplace/etsy-auth.js';
import { reverbAuthRouter } from './routes/marketplace/reverb-auth.js';
import { adminRouter } from './routes/admin.js';
import { shippingRouter } from './routes/shipping.js';
import { surveyRouter } from './routes/survey.js';
import { draftsRouter } from './routes/drafts.js';
import { preferencesRouter } from './routes/preferences.js';
import { sellerProfileRouter } from './routes/seller-profile.js';
import { prepareListingRouter } from './routes/prepare-listing.js';
import { usersRouter } from './routes/users.js';
import { billingRouter, billingWebhookRouter } from './routes/billing.js';

export function createApp() {
  const config = env();
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(cors({
    origin: config.NODE_ENV === 'production'
      ? ['https://portage.digitalharmonyai.com']
      : ['http://10.0.0.251:3002', 'http://10.0.0.251:3000', 'https://10.0.0.251:3002', 'https://portage.digitalharmonyai.com', 'https://rehearsal.digitalharmonyai.com'],
    credentials: true,
  }));

  app.use('/billing', billingWebhookRouter);
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
  app.use('/marketplace/etsy', etsyAuthRouter);
  app.use('/marketplace/reverb', reverbAuthRouter);
  app.use('/admin', adminRouter);
  app.use('/shipping', shippingRouter);
  app.use('/survey', surveyRouter);
  app.use('/drafts', draftsRouter);
  app.use('/users/me', usersRouter);
  app.use('/users/me/preferences', preferencesRouter);
  app.use('/seller-profile', sellerProfileRouter);
  app.use('/items', prepareListingRouter);
  app.use('/billing', billingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
