"use client";

import { useState } from "react";
import type { Overlay } from "@/lib/tutorials";

interface DeviceFrameProps {
  screenshot: string;
  overlays: Overlay[];
  animationKey: string | number;
  alt: string;
  compact?: boolean;
}

function overlayStyle(o: Overlay): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: `${o.x}%`,
    top: `${o.y}%`,
    animationDelay: o.delay ? `${o.delay}ms` : undefined,
  };
  if (o.type === "highlight") {
    return {
      ...base,
      width: `${o.w ?? 20}%`,
      height: `${o.h ?? 10}%`,
      borderRadius: "12px",
      border: "2px solid var(--forest-green)",
      animation: "tutorial-pulse-ring 1.6s ease-out infinite",
    };
  }
  if (o.type === "tap") {
    return {
      ...base,
      width: "36px",
      height: "36px",
      marginLeft: "-18px",
      marginTop: "-18px",
      borderRadius: "50%",
      background: "rgba(45, 90, 39, 0.45)",
      animation: "tutorial-tap-ripple 1.4s ease-out infinite",
    };
  }
  if (o.type === "swipe") {
    return {
      ...base,
      animation: "tutorial-swipe-x 1.6s ease-in-out infinite",
    };
  }
  // callout
  return {
    ...base,
    transform: "translateX(-50%)",
    maxWidth: "80%",
    animation: "tutorial-callout-in 0.4s ease-out both",
  };
}

export function DeviceFrame({ screenshot, overlays, animationKey, alt, compact }: DeviceFrameProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-[2rem] border-[6px] bg-black ${compact ? "w-28" : "w-full max-w-[280px]"}`}
      style={{ borderColor: "#1a1a1a", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
      {/* Screenshot area — 390×844 aspect via padding trick (iOS aspect-ratio collapse gotcha) */}
      <div className="relative w-full" style={{ paddingBottom: `${(844 / 390) * 100}%` }}>
        {failed ? (
          <div
            data-testid="device-frame-placeholder"
            className="absolute inset-0 flex items-center justify-center bg-muted"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Screenshot unavailable">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- static tutorial asset, natural-size coords depend on raw img */}
            <img
              src={screenshot}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
            <div key={animationKey} className="absolute inset-0" aria-hidden="true">
              {overlays.map((o, i) => (
                <div key={i} data-testid="tutorial-overlay" className="tutorial-overlay" style={overlayStyle(o)}>
                  {o.type === "callout" && o.text && (
                    <span
                      className="block rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
                      style={{ background: "var(--forest-green)" }}
                    >
                      {o.text}
                    </span>
                  )}
                  {o.type === "swipe" && (
                    <svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="var(--forest-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 10h30M26 4l6 6-6 6" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
