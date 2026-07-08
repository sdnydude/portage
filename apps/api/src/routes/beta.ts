import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = createLogger('beta');

// LAN-internal DHG Registry — the browser can't reach it, so the API proxies
// and stamps the reporter identity server-side.
const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://10.0.0.251:8011';

const reportSchema = z.object({
  page: z.string().min(1).max(500),
  area: z.string().max(100).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1).max(10_000),
  screenshotUrl: z.string().url().max(2000).optional(),
});

export const betaRouter = Router();

betaRouter.use(requireAuth);

betaRouter.post('/report', async (req, res, next) => {
  try {
    const body = reportSchema.parse(req.body);

    const response = await fetch(`${REGISTRY_URL}/api/beta-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: 'portage',
        reporter_email: req.user!.email,
        reporter_user_id: req.user!.sub,
        page: body.page,
        area: body.area ?? null,
        severity: body.severity,
        description: body.description,
        screenshot_url: body.screenshotUrl ?? null,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch((err: Error) => {
      logger.error({ error: err.message }, 'Registry unreachable for beta report');
      throw new AppError(502, 'REGISTRY_UNAVAILABLE', 'Could not deliver the report — please try again.');
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Registry rejected beta report');
      throw new AppError(502, 'REGISTRY_UNAVAILABLE', 'Could not deliver the report — please try again.');
    }

    const created = await response.json();
    logger.info({ userId: req.user!.sub, severity: body.severity, page: body.page }, 'Beta report submitted');

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
