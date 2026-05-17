import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, stripeEvents } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('billing');

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError(500, 'CONFIG_ERROR', 'Stripe not configured');
  return new Stripe(key);
}

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
      const existing = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, event.id)).limit(1);
      if (existing.length > 0) {
        res.json({ received: true, duplicate: true });
        return;
      }

      await db.insert(stripeEvents).values({ eventId: event.id, type: event.type });

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === 'subscription' && session.customer && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            await db.update(users)
              .set({
                subscriptionTier: 'pro',
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
              })
              .where(eq(users.email, session.customer_email!));
            logger.info({ email: session.customer_email }, 'Subscription activated via checkout');
          } else if (session.mode === 'payment' && session.metadata?.type === 'credit_pack') {
            const { sql } = await import('drizzle-orm');
            const qty = Number(session.metadata.quantity) || 10;
            await db.update(users)
              .set({ aiListingCredits: sql`${users.aiListingCredits} + ${qty}` })
              .where(eq(users.email, session.customer_email!));
            logger.info({ email: session.customer_email, qty }, 'Credit pack purchased');
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const priceId = sub.items.data[0]?.price.id;
          if (priceId) {
            await db.update(users)
              .set({ stripePriceId: priceId })
              .where(eq(users.stripeCustomerId, sub.customer as string));
            logger.info({ customerId: sub.customer, priceId }, 'Subscription plan updated');
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

billingRouter.post('/create-checkout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
      success_url: `${req.headers.origin || 'https://portage.digitalharmonyai.com'}/settings/billing?success=true`,
      cancel_url: `${req.headers.origin || 'https://portage.digitalharmonyai.com'}/settings/billing?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/create-portal', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRows = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
    const user = userRows[0];
    if (!user?.stripeCustomerId) {
      throw new AppError(400, 'NO_SUBSCRIPTION', 'No active Stripe customer');
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.headers.origin || 'https://portage.digitalharmonyai.com'}/settings/billing`,
      ...(process.env.STRIPE_PORTAL_CONFIG ? { configuration: process.env.STRIPE_PORTAL_CONFIG } : {}),
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/buy-credits', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
      success_url: `${req.headers.origin || 'https://portage.digitalharmonyai.com'}/settings/billing?credits=purchased`,
      cancel_url: `${req.headers.origin || 'https://portage.digitalharmonyai.com'}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});
