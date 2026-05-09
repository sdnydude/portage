"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FAQ = [
  {
    q: "How do I scan an item?",
    a: "Tap the Scan button in the center of the bottom navigation bar. Point your camera at the item and take a photo. Our AI will identify it and estimate its value.",
  },
  {
    q: "How do I list an item for sale?",
    a: "From your inventory, tap an item, then tap \"List This Item.\" Choose your preferred listing mode (Conversational, Swipe, or Hybrid) and follow the steps to publish to eBay, Etsy, or Reverb.",
  },
  {
    q: "How do I connect a marketplace account?",
    a: "Go to More > Marketplace Accounts and tap \"Connect\" next to eBay or Etsy. You'll be redirected to authorize Portage to manage listings on your behalf.",
  },
  {
    q: "What's included in the free tier?",
    a: "Free accounts get 25 AI scans per month, 5 background removals, 20 Porter messages per day, and 1 marketplace connection. Upgrade to Pro for unlimited access.",
  },
  {
    q: "Who is Porter?",
    a: "Porter is your AI selling assistant. Ask Porter about inventory values, listing strategies, or get help writing descriptions. Access Porter from the home page or by navigating to the Porter chat.",
  },
  {
    q: "How do I ship a sold item?",
    a: "When an item sells, it appears in your Orders tab. Tap the order, then tap \"Ship\" to purchase a shipping label and mark it as shipped.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Help & Support</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Contact */}
        <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
          <h2 className="text-sm font-semibold text-text-primary mb-2">Contact Support</h2>
          <a
            href="mailto:support@digitalharmonyai.com"
            className="text-sm text-forest-green hover:underline"
          >
            support@digitalharmonyai.com
          </a>
          <p className="text-xs text-text-secondary mt-1">We typically respond within 24 hours.</p>
        </div>

        {/* FAQ */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary px-1">Frequently Asked Questions</h2>
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
              style={{ boxShadow: "var(--shadow-subtle)" }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={openIndex === i}
              >
                <span className="text-sm font-medium text-text-primary pr-4">{item.q}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-placeholder)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`flex-shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 -mt-1">
                  <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* App info */}
        <div className="text-center space-y-1 pt-4">
          <p className="text-xs text-text-placeholder">Portage v1.0.0</p>
          <p className="text-xs text-text-placeholder">Digital Harmony Group</p>
        </div>
      </div>
    </div>
  );
}
