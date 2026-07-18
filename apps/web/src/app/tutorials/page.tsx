"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TUTORIAL_TOPICS } from "@/lib/tutorials";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  setup: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  "adding-items": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  listings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  orders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  porter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 017 7v3a7 7 0 01-14 0V9a7 7 0 017-7z" />
      <circle cx="9" cy="11" r="1" />
      <circle cx="15" cy="11" r="1" />
    </svg>
  ),
  messages: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
};

export default function TutorialsHubPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => router.back()} className="-ml-1 p-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">Tutorials</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-2 px-4 py-6 compact-bar-clearance">
        {TUTORIAL_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/tutorials/${topic.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-muted"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-forest-green-50">
              {TOPIC_ICONS[topic.slug]}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-text-primary">{topic.title}</h2>
              <p className="mt-0.5 text-xs text-text-secondary">{topic.description}</p>
            </div>
            <span className="flex-shrink-0 text-xs text-text-placeholder">{topic.steps.length} steps</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}

        <div className="pt-4">
          <button
            onClick={() => setShowIntro(true)}
            className="w-full rounded-2xl border border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-muted"
          >
            Replay intro
          </button>
        </div>
      </div>

      {showIntro && (
        <OnboardingFlow
          onComplete={async () => setShowIntro(false)}
          onSkip={async () => setShowIntro(false)}
          isCompleting={false}
        />
      )}
    </div>
  );
}
