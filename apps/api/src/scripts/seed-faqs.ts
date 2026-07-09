/**
 * Seed the approved FAQ set (2026-07-08). Idempotent: skips any question that
 * already exists, so re-runs never duplicate and never clobber admin edits.
 *
 * Run: npx tsx apps/api/src/scripts/seed-faqs.ts
 * (host runs need DATABASE_URL pointed at 127.0.0.1:5436)
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { faqs } from '../db/schema.js';
import { loadEnv } from '../lib/env.js';

const APPROVED_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: 'How do I scan an item?',
    answer: 'Tap the Scan button in the center of the bottom bar. Take one or more photos of your item — the AI identifies it, fills in details, and estimates its value. You can review and edit everything before saving.',
  },
  {
    question: 'How do I list an item for sale?',
    answer: 'Open the item from your Inventory and tap "List on Marketplace," or start from the List tab to use a guided flow (Conversational, Swipe, or Hybrid). Pick eBay or Reverb, set your price, and publish immediately or save a draft.',
  },
  {
    question: 'How do I connect a marketplace account?',
    answer: 'Go to Settings → Marketplace Accounts. eBay connects through a secure sign-in. Reverb uses a personal access token — generate one on reverb.com under API & Integrations, then paste it in.',
  },
  {
    question: "What's included in the free tier?",
    answer: 'Free accounts get 25 AI scans and 10 AI-prepared listings per month, 5 background removals, 20 Porter messages per day, and 1 marketplace connection.',
  },
  {
    question: 'Who is Porter?',
    answer: 'Porter is your AI selling assistant. Ask Porter about inventory values, listing strategies, or get help writing descriptions. Access Porter from the home page or by navigating to the Porter chat.',
  },
  {
    question: 'How do I ship a sold item?',
    answer: 'Sold items appear in the Orders tab. Tap "Ship It" on an eBay order to open eBay\'s shipping page, where you buy the label. Tracking and status sync back to Portage automatically.',
  },
  {
    question: 'Which marketplaces does Portage support?',
    answer: 'eBay and Reverb. You can list the same item on any connected marketplace, and Portage keeps price, inventory, and orders in sync.',
  },
  {
    question: "What's the difference between a draft and a published listing?",
    answer: 'A draft lives only in Portage — nothing is sent to the marketplace until you publish. "Publish immediately" puts the listing live in one step. On eBay you can also save a Seller Hub draft.',
  },
  {
    question: 'How do photo tools work?',
    answer: 'Open any photo on an item to crop, rotate, auto-enhance, adjust exposure, or remove the background. A before/after slider shows changes before you apply them.',
  },
  {
    question: 'Where do price suggestions come from?',
    answer: 'Portage looks at recently sold and active comparable listings on eBay and Reverb, then suggests a range plus a recommended price. You always set the final price.',
  },
  {
    question: 'What does eBay auto-end do?',
    answer: "An optional setting that ends eBay listings two days before their monthly Good-'Til-Cancelled renewal, so you're never charged an unwanted re-listing fee. Ended items are archived, not deleted.",
  },
  {
    question: 'Is my marketplace login safe?',
    answer: 'Portage never sees or stores marketplace passwords. eBay uses official sign-in (OAuth); Reverb uses a token you can revoke anytime. All tokens are encrypted at rest.',
  },
  {
    question: 'How do I report a bug or give feedback?',
    answer: 'Tap the Beta pill in the top corner of any page. Describe what happened — your report goes straight to the team.',
  },
  {
    question: 'Can I sell an item on more than one marketplace?',
    answer: 'Yes — list the same inventory item on each marketplace separately. When it sells anywhere, mark others ended from the listing page to avoid double-selling.',
  },
];

async function main() {
  loadEnv();
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < APPROVED_FAQS.length; i++) {
    const f = APPROVED_FAQS[i];
    const existing = await db.select({ id: faqs.id }).from(faqs).where(eq(faqs.question, f.question)).limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(faqs).values({ question: f.question, answer: f.answer, sortOrder: i, published: true });
    inserted++;
  }
  console.log(`FAQ seed complete: ${inserted} inserted, ${skipped} skipped (already present)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('FAQ seed failed:', err);
  process.exit(1);
});
