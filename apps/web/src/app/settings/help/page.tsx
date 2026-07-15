"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

export default function HelpPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [faqList, setFaqList] = useState<Faq[]>([]);
  const [faqError, setFaqError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ faqs: Faq[] }>("/faqs", { token })
      .then((data) => { if (!cancelled) setFaqList(data.faqs); })
      .catch(() => { if (!cancelled) setFaqError(true); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 content-container">
          <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Help & Support</h1>
        </div>
      </header>

      <div className="px-4 py-6 content-container space-y-6 compact-bar-clearance">
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
          {faqError && (
            <p className="text-sm text-text-secondary px-1">
              FAQs couldn&apos;t be loaded right now — email support and we&apos;ll help directly.
            </p>
          )}
          {faqList.map((item, i) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
              style={{ boxShadow: "var(--shadow-subtle)" }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={openIndex === i}
              >
                <span className="text-sm font-medium text-text-primary pr-4">{item.question}</span>
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
                  <p className="text-sm text-text-secondary leading-relaxed">{item.answer}</p>
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
