/**
 * One-shot script: creates Stripe products + prices in TEST mode.
 * Run once, then store the resulting price IDs in Doppler.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx apps/api/src/scripts/setup-stripe-products.ts
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_test_')) {
  console.error('ERROR: Set STRIPE_SECRET_KEY to a test-mode key (sk_test_...)');
  process.exit(1);
}

const stripe = new Stripe(key);

async function main() {
  console.log('Creating Stripe products and prices (test mode)...\n');

  // 1. Pro subscription product
  const proProduct = await stripe.products.create({
    name: 'Portage Pro',
    description: 'AI-powered listing generation, unlimited background removals, all marketplaces',
    metadata: { app: 'portage' },
  });
  console.log(`Product: ${proProduct.id} — ${proProduct.name}`);

  // 2. Monthly price
  const monthlyPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 3900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'monthly' },
  });
  console.log(`  Monthly price: ${monthlyPrice.id} — $39/month`);

  // 3. Annual price
  const annualPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 39000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'annual' },
  });
  console.log(`  Annual price: ${annualPrice.id} — $390/year`);

  // 4. Credit pack product (one-time)
  const creditProduct = await stripe.products.create({
    name: 'Portage AI Listing Credits (10-pack)',
    description: '10 AI listing credits — never expire',
    metadata: { app: 'portage', type: 'credit_pack' },
  });
  console.log(`\nProduct: ${creditProduct.id} — ${creditProduct.name}`);

  const creditPrice = await stripe.prices.create({
    product: creditProduct.id,
    unit_amount: 500,
    currency: 'usd',
    metadata: { type: 'credit_pack', quantity: '10' },
  });
  console.log(`  Credit price: ${creditPrice.id} — $5 one-time`);

  console.log('\n--- Add these to Doppler (portage/dev environment): ---');
  console.log(`STRIPE_PRICE_MONTHLY=${monthlyPrice.id}`);
  console.log(`STRIPE_PRICE_ANNUAL=${annualPrice.id}`);
  console.log(`STRIPE_PRICE_CREDITS=${creditPrice.id}`);
  console.log('');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
