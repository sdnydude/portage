"use client";

import { useCallback, useState } from "react";
import type { TutorialTopic } from "@/lib/tutorials";
import { DeviceFrame } from "./device-frame";

interface TutorialPlayerProps {
  topic: TutorialTopic;
}

export function TutorialPlayer({ topic }: TutorialPlayerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = topic.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === topic.steps.length - 1;

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, topic.steps.length - 1));
  }, [topic.steps.length]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-4 compact-bar-clearance">
      {/* Sized so a full step (frame + text + dots + nav) fits a 390×844
          viewport without scrolling — the frame is capped, not w-full. */}
      <div className="w-full max-w-[210px]">
        <DeviceFrame
          screenshot={step.screenshot}
          overlays={step.overlays}
          animationKey={step.id}
          alt={step.title}
        />
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

      <div className="mt-4 flex w-full items-center gap-3">
        {!isFirst && (
          <button
            onClick={goPrev}
            className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-muted"
          >
            Back
          </button>
        )}
        {!isLast && (
          <button
            onClick={goNext}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: "var(--forest-green)" }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
