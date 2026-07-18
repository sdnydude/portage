"use client";

import { useState, useCallback } from "react";
import { DeviceFrame } from "@/components/tutorials/device-frame";
import type { Overlay } from "@/lib/tutorials";

interface OnboardingFlowProps {
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  isCompleting: boolean;
  onExploreTutorials?: () => void;
}

interface Step {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  screenshot: string;
  overlays: Overlay[];
}

const STEPS: Step[] = [
  {
    id: 0,
    title: "Welcome to Portage",
    subtitle: "Your AI-powered selling assistant",
    body: "Turn your clutter into cash. Portage scans your items, identifies them instantly, and lists them across top marketplaces — all in seconds.",
    screenshot: "/tutorials/adding-items/scan-home.png",
    overlays: [{ type: "callout", x: 50, y: 40, text: "Your selling HQ", delay: 400 }],
  },
  {
    id: 1,
    title: "Scan & Inventory",
    subtitle: "AI identifies your items instantly",
    body: "Point your camera at any item. Porter's AI recognizes it, estimates its value, and adds it to your personal inventory catalog — automatically.",
    screenshot: "/tutorials/adding-items/scan-home.png",
    overlays: [{ type: "tap", x: 50, y: 93 }],
  },
  {
    id: 2,
    title: "List Anywhere",
    subtitle: "eBay · Reverb — one flow",
    body: "Choose your marketplace, pick your listing style — conversational, swipe, or hybrid — and Porter handles the details: title, description, pricing, and more.",
    screenshot: "/tutorials/listings/create-listing.png",
    overlays: [{ type: "highlight", x: 8, y: 25, w: 84, h: 30 }],
  },
  {
    id: 3,
    title: "Track & Ship",
    subtitle: "Orders, shipping, and analytics",
    body: "Monitor sales across all marketplaces in one place. Generate shipping labels, track packages, and watch your revenue grow — all from a single dashboard.",
    screenshot: "/tutorials/orders/orders-tab.png",
    overlays: [{ type: "highlight", x: 6, y: 20, w: 88, h: 30 }],
  },
  {
    id: 4,
    title: "You're all set",
    subtitle: "Start selling in seconds",
    body: "Scan your first item, and Porter will guide you through the rest. Your selling journey starts now.",
    screenshot: "/tutorials/inventory/browse.png",
    overlays: [{ type: "callout", x: 50, y: 30, text: "Let's go", delay: 300 }],
  },
];

export function OnboardingFlow({ onComplete, onSkip, isCompleting, onExploreTutorials }: OnboardingFlowProps) {
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
            <div className="mb-6 mt-2">
              <DeviceFrame
                screenshot={step.screenshot}
                overlays={step.overlays}
                animationKey={step.id}
                alt={step.title}
                compact
              />
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
            {isLastStep && onExploreTutorials && (
              <button
                onClick={onExploreTutorials}
                className="flex-1 py-3 rounded-2xl border border-border text-text-secondary font-semibold text-sm hover:bg-muted transition-colors"
                disabled={isCompleting}
              >
                Explore tutorials
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
