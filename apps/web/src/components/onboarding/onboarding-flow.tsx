"use client";

import { useState, useCallback } from "react";

interface OnboardingFlowProps {
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  isCompleting: boolean;
}

interface Step {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  icon: React.ReactNode;
}

function EbayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="eBay">
      <rect width="28" height="28" rx="6" fill="#E53238" />
      <text x="4" y="20" fontSize="11" fontWeight="700" fill="white" fontFamily="sans-serif">eBay</text>
    </svg>
  );
}

function EtsyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Etsy">
      <rect width="28" height="28" rx="6" fill="#F56400" />
      <text x="5" y="20" fontSize="11" fontWeight="700" fill="white" fontFamily="sans-serif">etsy</text>
    </svg>
  );
}

function ReverbIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Reverb">
      <rect width="28" height="28" rx="6" fill="#343E47" />
      <path d="M8 10h8a4 4 0 010 8H8V10z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS: Step[] = [
  {
    id: 0,
    title: "Welcome to Portage",
    subtitle: "Your AI-powered selling assistant",
    body: "Turn your clutter into cash. Portage scans your items, identifies them instantly, and lists them across top marketplaces — all in seconds.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 1,
    title: "Scan & Inventory",
    subtitle: "AI identifies your items instantly",
    body: "Point your camera at any item. Porter's AI recognizes it, estimates its value, and adds it to your personal inventory catalog — automatically.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "List Anywhere",
    subtitle: "eBay · Etsy · Reverb — one flow",
    body: "Choose your marketplace, pick your listing style — conversational, swipe, or hybrid — and Porter handles the details: title, description, pricing, and more.",
    icon: (
      <div className="flex items-center gap-3">
        <EbayIcon />
        <EtsyIcon />
        <ReverbIcon />
      </div>
    ),
  },
  {
    id: 3,
    title: "Track & Ship",
    subtitle: "Orders, shipping, and analytics",
    body: "Monitor sales across all marketplaces in one place. Generate shipping labels, track packages, and watch your revenue grow — all from a single dashboard.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "You're all set",
    subtitle: "Start selling in seconds",
    body: "Scan your first item, and Porter will guide you through the rest. Your selling journey starts now.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

export function OnboardingFlow({ onComplete, onSkip, isCompleting }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const isLastStep = currentStep === STEPS.length - 1;

  const goNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setDirection("next");
    setCurrentStep((s) => s + 1);
  }, [isLastStep, onComplete]);

  const goPrev = useCallback(() => {
    if (currentStep === 0) return;
    setDirection("prev");
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const step = STEPS[currentStep];

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Portage onboarding"
    >
      {/* Card container */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-safe">
        <div
          className="w-full max-w-sm rounded-3xl max-h-[90dvh] overflow-y-auto"
          style={{
            background: "var(--surface)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          }}
        >
          {/* Skip button */}
          <div className="flex justify-end px-5 pt-5">
            <button
              onClick={onSkip}
              className="text-text-secondary font-medium text-sm hover:text-text-primary transition-colors"
              disabled={isCompleting}
              aria-label="Skip onboarding"
            >
              Skip
            </button>
          </div>

          {/* Step content */}
          <div
            key={`step-${currentStep}-${direction}`}
            className="px-6 pt-2 pb-6 flex flex-col items-center text-center"
            style={{
              animation: "onboarding-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            {/* Icon */}
            <div className="w-24 h-24 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6 mt-2">
              {step.icon}
            </div>

            {/* Text */}
            <h2
              className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-1"
              style={{ fontSize: "var(--text-title)" }}
            >
              {step.title}
            </h2>
            <p
              className="font-[family-name:var(--font-plus-jakarta)] font-semibold mb-4"
              style={{ fontSize: "var(--text-body)", color: "var(--forest-green)" }}
            >
              {step.subtitle}
            </p>
            <p
              className="font-[family-name:var(--font-plus-jakarta)] text-text-secondary leading-relaxed"
              style={{ fontSize: "var(--text-body)" }}
            >
              {step.body}
            </p>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 pb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === currentStep ? "20px" : "6px",
                  height: "6px",
                  background: i === currentStep ? "var(--forest-green)" : "var(--border)",
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3 px-6 pb-6">
            {currentStep > 0 && (
              <button
                onClick={goPrev}
                className="flex-1 py-3 rounded-2xl border border-border text-text-secondary font-semibold text-sm hover:bg-muted transition-colors"
                disabled={isCompleting}
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: "var(--forest-green)",
                color: "white",
              }}
              disabled={isCompleting}
            >
              {isCompleting
                ? "Starting…"
                : isLastStep
                  ? "Start Scanning"
                  : "Next"}
            </button>
          </div>
        </div>
      </div>

      {/* Slide animation keyframes injected via style tag */}
      <style>{`
        @keyframes onboarding-slide-in {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
