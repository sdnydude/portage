"use client";

import { useCallback, useRef, useState } from "react";
import type { TutorialTopic } from "@/lib/tutorials";
import { DeviceFrame } from "./device-frame";

interface TutorialPlayerProps {
  topic: TutorialTopic;
}

export function TutorialPlayer({ topic }: TutorialPlayerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const step = topic.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === topic.steps.length - 1;

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, topic.steps.length - 1));
  }, [topic.steps.length]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const chevronClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary hover:bg-muted disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center px-4 py-4 compact-bar-clearance"
      // Carousel idiom: swipe on touch devices, chevrons on desktop.
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (dx <= -48) goNext();
        else if (dx >= 48) goPrev();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goNext();
        if (e.key === "ArrowLeft") goPrev();
      }}
    >
      {/* Chevrons flank the frame; frame capped so a full step (frame +
          text + dots) fits a 390×844 viewport without scrolling. */}
      <div className="flex w-full items-center justify-center gap-3">
        <button onClick={goPrev} aria-label="Previous step" disabled={isFirst} className={chevronClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="w-full max-w-[210px]">
          <DeviceFrame
            screenshot={step.screenshot}
            overlays={step.overlays}
            animationKey={step.id}
            alt={step.title}
          />
        </div>
        <button onClick={goNext} aria-label="Next step" disabled={isLast} className={chevronClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mt-4 w-full text-center">
        <h2
          className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
          style={{ fontSize: "var(--text-title)" }}
        >
          {step.title}
        </h2>
        <p
          className="mt-2 font-[family-name:var(--font-plus-jakarta)] leading-relaxed text-text-secondary"
          style={{ fontSize: "var(--text-body)" }}
        >
          {step.body}
        </p>
      </div>

      {/* Dot indicators — same pattern as onboarding-flow.tsx */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {topic.steps.map((s, i) => (
          <div
            key={s.id}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === stepIndex ? "20px" : "6px",
              height: "6px",
              background: i === stepIndex ? "var(--forest-green)" : "var(--border)",
            }}
            aria-hidden="true"
          />
        ))}
      </div>

    </div>
  );
}
