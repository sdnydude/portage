import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, stripeEvents } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';
import { computeEffectiveTier } from '../lib/billing-utils.js';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@portage/shared';

const logger = createLogger('billing');

const APP_BASE_URL = process.env.APP_URL ?? 'https://portage.digitalharmonyai.com';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new AppError(500, 'CONFIG_ERROR', 'Stripe not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

const billingLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'unknown',
  message: { error: 'Too many billing requests, please try again later', code: 'RATE_LIMITED' },
});

export const billingRouter = Router();

// --- Webhook (raw body, no auth — signature-verified) ---

export const billingWebhookRouter = Router();
billingWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      logger.warn({ error: (err as Error).message }, 'Webhook signature verification failed');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      // Atomic idempotency: INSERT first, use PK constraint as the lock
      const [claimed] = await db.insert(stripeEvents)
        .values({ eventId: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ eventId: stripeEvents.eventId });

      if (!claimed) {
        res.json({ received: true, duplicate: true });
        return;
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === 'subscription' && session.customer && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const whereClause = session.customer_email
              ? eq(users.email, session.customer_email)
              : eq(users.stripeCustomerId, session.customer as string);
            await db.update(users)
              .set({
                subscriptionTier: 'pro',
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
              })
              .where(whereClause);
            logger.info({ email: session.customer_email, customerId: session.customer }, 'Subscription activated via checkout');
          } else if (session.mode === 'payment' && session.metadata?.type === 'credit_pack') {
            const qty = Number(session.metadata.quantity) || 10;
            const userId = session.metadata.userId;
            const whereClause = userId
              ? eq(users.id, userId)
              : session.customer_email
                ? eq(users.email, session.customer_email)
                : eq(users.stripeCustomerId, session.customer as string);
            await db.update(users)
              .set({ aiListingCredits: sql`${users.aiListingCredits} + ${qty}` })
              .where(whereClause);
            logger.info({ userId, email: session.customer_email, qty }, 'Credit pack purchased');
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const priceId = sub.items.data[0]?.price.id;
          const updates: Record<string, unknown> = {};
          if (priceId) updates.stripePriceId = priceId;
          if (sub.status === 'active') updates.subscriptionTier = 'pro';
          if (Object.keys(updates).length > 0) {
            await db.update(users)
              .set(updates)
              .where(eq(users.stripeCustomerId, sub.customer as string));
            logger.info({ customerId: sub.customer, priceId, status: sub.status }, 'Subscription updated');
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await db.update(users)
            .set({
              subscriptionTier: 'free',
              stripeSubscriptionId: null,
              stripePriceId: null,
            })
            .where(eq(users.stripeCustomerId, sub.customer as string));
          logger.info({ customerId: sub.customer }, 'Subscription cancelled — downgraded to free');
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          logger.warn({ customerId: invoice.customer }, 'Payment failed — Stripe will retry');
          break;
        }

        default:
          logger.info({ type: event.type }, 'Unhandled webhook event type');
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);

// --- Authenticated routes ---

billingRouter.post('/create-checkout', requireAuth, billingLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body;
    if (!plan || !['monthly', 'annual'].includes(plan)) {
      throw new AppError(400, 'INVALID_PLAN', 'Plan must be "monthly" or "annual"');
    }

    const stripe = getStripe();
    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_ANNUAL;

    if (!priceId) throw new AppError(500, 'CONFIG_ERROR', 'Price not configured');

    const userRows = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
    const user = userRows[0];
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.stripeCustomerId ? undefined : user.email,
      customer: user.stripeCustomerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_BASE_URL}/settings/billing?success=true`,
      cancel_url: `${APP_BASE_URL}/settings/billing?cancelled=true`,
    });

    if (!session.url) throw new AppError(500, 'STRIPE_ERROR', 'Stripe did not return a redirect URL');
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/create-portal', requireAuth, billingLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRows = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
    const user = userRows[0];
    if (!user?.stripeCustomerId) {
      throw new AppError(400, 'NO_SUBSCRIPTION', 'No active Stripe customer');
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_BASE_URL}/settings/billing`,
      ...(process.env.STRIPE_PORTAL_CONFIG ? { configuration: process.env.STRIPE_PORTAL_CONFIG } : {}),
    });

    if (!session.url) throw new AppError(500, 'STRIPE_ERROR', 'Stripe did not return a redirect URL');
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/buy-credits', requireAuth, billingLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = getStripe();
    const priceId = process.env.STRIPE_PRICE_CREDITS;
    if (!priceId) throw new AppError(500, 'CONFIG_ERROR', 'Credit price not configured');

    const userRows = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
    const user = userRows[0];
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.stripeCustomerId ? undefined : user.email,
      customer: user.stripeCustomerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { type: 'credit_pack', quantity: '10', userId: user.id },
      success_url: `${APP_BASE_URL}/settings/billing?credits=purchased`,
      cancel_url: `${APP_BASE_URL}/settings/billing`,
    });

    if (!session.url) throw new AppError(500, 'STRIPE_ERROR', 'Stripe did not return a redirect URL');
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      stripeSubscriptionId: users.stripeSubscriptionId,
      stripePriceId: users.stripePriceId,
      aiScansThisMonth: users.aiScansThisMonth,
      aiListingsThisMonth: users.aiListingsThisMonth,
      aiListingCredits: users.aiListingCredits,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const effectiveTier = computeEffectiveTier(user.subscriptionTier, user.trialEndsAt);
    const isPro = effectiveTier === 'pro';

    const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
    const priceAnnual = process.env.STRIPE_PRICE_ANNUAL;
    let plan: 'monthly' | 'annual' | null = null;
    if (user.stripePriceId === priceAnnual) plan = 'annual';
    else if (user.stripePriceId === priceMonthly) plan = 'monthly';
    else if (user.stripeSubscriptionId) plan = 'monthly';

    let trial: { active: boolean; endsAt: string } | null = null;
    if (user.trialEndsAt) {
      trial = {
        active: user.trialEndsAt.getTime() > Date.now(),
        endsAt: user.trialEndsAt.toISOString(),
      };
    }

    res.json({
      effectiveTier,
      trial,
      subscription: user.stripeSubscriptionId
        ? { id: user.stripeSubscriptionId, plan }
        : null,
      usage: {
        aiListings: {
          used: user.aiListingsThisMonth,
          limit: isPro ? PRO_TIER_LIMITS.aiListingsPerMonth : FREE_TIER_LIMITS.aiListingsPerMonth,
          credits: user.aiListingCredits,
        },
        bgRemovals: {
          used: user.bgRemovalsThisMonth,
          limit: isPro ? PRO_TIER_LIMITS.bgRemovalsPerMonth : FREE_TIER_LIMITS.bgRemovalsPerMonth,
        },
        porterExchanges: {
          limit: isPro ? PRO_TIER_LIMITS.porterExchangesPerDay : FREE_TIER_LIMITS.porterExchangesPerDay,
        },
        marketplaces: {
          limit: isPro ? PRO_TIER_LIMITS.marketplaces : FREE_TIER_LIMITS.marketplaces,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
