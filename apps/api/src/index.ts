import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { loadEnv } from './lib/env.js';
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
import { ebayAuthRouter } from './routes/marketplace/ebay-auth.js';
import { etsyAuthRouter } from './routes/marketplace/etsy-auth.js';
import { adminRouter } from './routes/admin.js';

const config = loadEnv();

const app = express();

app.use(cors({
  origin: config.NODE_ENV === 'production'
    ? ['https://portage.digitalharmonyai.com']
    : ['http://10.0.0.251:3002', 'http://10.0.0.251:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ level: config.NODE_ENV === 'production' ? 'info' : 'debug' }));

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/images', imagesRouter);
app.use('/scan', scanRouter);
app.use('/items', itemsRouter);
app.use('/usage', usageRouter);
app.use('/listings', listingsRouter);
app.use('/orders', ordersRouter);
app.use('/porter', porterRouter);
app.use('/marketplace/ebay', ebayAuthRouter);
app.use('/marketplace/etsy', etsyAuthRouter);
app.use('/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.API_PORT, () => {
  console.log(`portage-api listening on port ${config.API_PORT}`);
});
