"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useListingFlow, type PublishOptions as PublishOpts } from "@/hooks/use-listing-flow";
import { usePhotoEdit } from "@/hooks/use-photo-edit";
import { PhotoGalleryStrip } from "../capture/photo-gallery-strip";
import { PhotoEditOverlay } from "../capture/photo-edit-overlay";
import { formatCondition } from "@/lib/format";
import { ebayEstimateToWeightDims } from "@/lib/weight";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";
import { PhotoCaptureOverlay } from "./photo-capture-overlay";
import { AspectFillSheet, type AspectRequirement } from "../listing/aspect-fill-sheet";
import { WeightDimsInputsInline } from "../listing/weight-dims-inputs";
import { WeightFillSheet } from "../listing/weight-fill-sheet";
import { usePrepareListing } from "@/hooks/use-prepare-listing";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

type Phase =
  | "recognition"
  | "configure"
  | "details"
  | "shipping"
  | "review"
  | "publishing"
  | "success";

export interface SwipeFlowProps {
  itemId?: string;
}

const PHASE_ORDER: Phase[] = [
  "recognition",
  "configure",
  "details",
  "shipping",
  "review",
  "publishing",
  "success",
];

/* ─────────────────────────────────────────────
   Inline styles / keyframes injected once
───────────────────────────────────────────── */

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

@keyframes sf-pulse-ring {
  0%   { transform: scale(0.95); opacity: 0.8; }
  50%  { transform: scale(1.08); opacity: 0.4; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

@keyframes sf-scan-line {
  0%   { top: 10%; opacity: 1; }
  48%  { opacity: 1; }
  50%  { top: 90%; opacity: 0.3; }
  52%  { opacity: 1; }
  100% { top: 10%; opacity: 1; }
}

@keyframes sf-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes sf-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.15; }
}

@keyframes sf-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes sf-heartbeat {
  0%, 100% { transform: scale(1); }
  14%       { transform: scale(1.04); }
  28%       { transform: scale(1); }
  42%       { transform: scale(1.02); }
  70%       { transform: scale(1); }
}

.sf-scan-ring {
  animation: sf-pulse-ring 2s ease-in-out infinite;
}
.sf-scan-line {
  animation: sf-scan-line 2.4s linear infinite;
}
.sf-fade-up {
  animation: sf-fade-up 0.35s ease-out both;
}
.sf-blink {
  animation: sf-blink 1.2s ease-in-out infinite;
}
.sf-spin {
  animation: sf-spin 1s linear infinite;
}
.sf-heartbeat {
  animation: sf-heartbeat 1.6s ease-in-out infinite;
}
`;

function GlobalStyles() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_STYLES;
    document.head.appendChild(tag);
  }, []);
  return null;
}

/* ─────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────── */

function OrangeButton({
  children,
  onClick,
  disabled,
  fullWidth,
  large,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  large?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#333" : "#F15A22",
        color: disabled ? "#666" : "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 600,
        fontSize: large ? "15px" : "13px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        border: "none",
        borderRadius: "10px",
        padding: large ? "18px 24px" : "14px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function OutlineButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        color: "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 600,
        fontSize: "13px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        border: "1px solid #444",
        borderRadius: "10px",
        padding: "14px 20px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SyneHeading({
  children,
  size = 24,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        textTransform: "uppercase",
        letterSpacing: size >= 28 ? "-1px" : "-0.5px",
        lineHeight: 1.1,
        color: "#fff",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function AiBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(241,90,34,0.18)",
        color: "#F15A22",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        padding: "2px 7px",
        borderRadius: "4px",
        marginLeft: "8px",
        verticalAlign: "middle",
      }}
    >
      AI
    </span>
  );
}

/* ─────────────────────────────────────────────
   Progress dots
───────────────────────────────────────────── */

function ProgressDots({
  phase,
  onBack,
}: {
  phase: Phase;
  onBack?: () => void;
}) {
  const visible: Phase[] = [
    "recognition",
    "configure",
    "details",
    "shipping",
    "review",
  ];
  const currentIndex = visible.indexOf(phase);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        padding: "env(safe-area-inset-top, 16px) 20px 16px",
        paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
        gap: 12,
      }}
    >
      {onBack && currentIndex > 0 && (
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "8px",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {currentIndex >= 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 6,
            justifyContent: currentIndex === 0 ? "flex-start" : "center",
          }}
        >
          {visible.map((p, i) => (
            <div
              key={p}
              style={{
                height: 3,
                flex: 1,
                maxWidth: 48,
                borderRadius: 2,
                background: i <= currentIndex ? "#F15A22" : "#333",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Loading overlay (used during photo scan)
───────────────────────────────────────────── */

function LoadingOverlay({ percent }: { percent: number }) {
  return (
    <div
      className="sf-fade-up"
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        className="sf-heartbeat"
        style={{ marginBottom: 32 }}
      >
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="#222" strokeWidth="2" />
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="#F15A22"
            strokeWidth="2"
            strokeDasharray={`${percent * 1.759} 176`}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
          <text
            x="32"
            y="37"
            textAnchor="middle"
            fill="#F15A22"
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight="600"
            fontSize="13"
          >
            {percent}%
          </text>
        </svg>
      </div>
      <SyneHeading size={22} style={{ color: "#fff" }}>
        <span className="sf-blink">SCANNING...</span>
      </SyneHeading>
      <p
        style={{
          color: "#666",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          marginTop: 12,
          letterSpacing: "0.1em",
        }}
      >
        IDENTIFYING YOUR ITEM
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 1 — Recognition
───────────────────────────────────────────── */

function RecognitionPhase({
  state,
  onConfirm,
  onRetry,
  onScan,
}: {
  state: ReturnType<typeof useListingFlow>["state"];
  onConfirm: () => void;
  onRetry: () => void;
  onScan: () => void;
}) {
  const photo = state.photos[state.primaryPhotoIndex];
  const candidate = state.recognition.candidates[state.recognition.selectedIndex];
  const confidence = Math.round((candidate?.confidence ?? state.recognition.confidence) * 100);

  return (
    <div
      className="sf-fade-up"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Full-bleed photo */}
      {photo ? (
        <img
          src={photo.url}
          alt="Item"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#111",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <button
            onClick={onScan}
            style={{
              background: "#F15A22",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Scan Item
          </button>
        </div>
      )}

      {/* Scan animation overlay */}
      {state.recognition.status !== "complete" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
          }}
        >
          {/* Corner brackets */}
          {[
            { top: "12%", left: "10%", borderTop: "2px solid #F15A22", borderLeft: "2px solid #F15A22" },
            { top: "12%", right: "10%", borderTop: "2px solid #F15A22", borderRight: "2px solid #F15A22" },
            { bottom: "30%", left: "10%", borderBottom: "2px solid #F15A22", borderLeft: "2px solid #F15A22" },
            { bottom: "30%", right: "10%", borderBottom: "2px solid #F15A22", borderRight: "2px solid #F15A22" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                ...s,
              }}
            />
          ))}

          {/* Scanning ring */}
          <div
            className="sf-scan-ring"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) translateY(-10%)",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: "1.5px solid rgba(241,90,34,0.5)",
            }}
          />

          {/* Scan line */}
          <div
            className="sf-scan-line"
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              height: "2px",
              background:
                "linear-gradient(90deg, transparent, #F15A22, transparent)",
            }}
          />
        </div>
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(transparent 40%, rgba(10,10,10,0.7) 65%, #0A0A0A 100%)",
          zIndex: 11,
        }}
      />

      {/* Bottom content */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 12,
          padding: "0 20px 40px",
        }}
      >
        {state.recognition.status === "complete" && candidate ? (
          <>
            {/* Confidence pill */}
            <div style={{ marginBottom: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  background: "rgba(241,90,34,0.2)",
                  border: "1px solid rgba(241,90,34,0.4)",
                  color: "#F15A22",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  padding: "4px 10px",
                  borderRadius: "6px",
                }}
              >
                {confidence}% MATCH
              </span>
            </div>

            {/* Item name */}
            <SyneHeading size={28} style={{ display: "block", marginBottom: 6 }}>
              {candidate.name}
            </SyneHeading>

            {/* Category + condition */}
            <p
              style={{
                color: "#999",
                fontSize: "13px",
                fontFamily: "'IBM Plex Mono', monospace",
                marginBottom: 24,
                letterSpacing: "0.05em",
              }}
            >
              {candidate.category} &bull; {formatCondition(candidate.condition)}
            </p>

            {/* Price range */}
            {(candidate.estimatedValueLow > 0 || candidate.estimatedValueHigh > 0) && (
              <div
                style={{
                  background: "#151515",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>
                  EST. VALUE
                </span>
                <span
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 800,
                    fontSize: "22px",
                    color: "#F15A22",
                    letterSpacing: "-0.5px",
                  }}
                >
                  ${candidate.estimatedValueLow}–${candidate.estimatedValueHigh}
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <OrangeButton onClick={onConfirm} fullWidth large>
                  CONFIRM
                </OrangeButton>
              </div>
              <OutlineButton onClick={onRetry}>RETRY</OutlineButton>
            </div>
          </>
        ) : state.recognition.status === "failed" ? (
          <>
            <SyneHeading size={22} style={{ display: "block", marginBottom: 8, color: "#fff" }}>
              SCAN FAILED
            </SyneHeading>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
              Couldn&apos;t identify this item.
            </p>
            <OrangeButton onClick={onRetry} fullWidth>TRY AGAIN</OrangeButton>
          </>
        ) : (
          <div style={{ textAlign: "center", paddingBottom: 8 }}>
            <span
              className="sf-blink"
              style={{
                color: "#F15A22",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                letterSpacing: "0.1em",
              }}
            >
              ANALYZING...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 2 — Configure (Pricing)
───────────────────────────────────────────── */

type PricingStrategy = "fast" | "market" | "max";

interface StrategyCard {
  id: PricingStrategy;
  label: string;
  sublabel: string;
  emoji: string;
}

const STRATEGY_CARDS: StrategyCard[] = [
  { id: "fast", label: "SELL FAST", sublabel: "85% of market", emoji: "⚡" },
  { id: "market", label: "MARKET", sublabel: "Median sold price", emoji: "⚖️" },
  { id: "max", label: "MAX VALUE", sublabel: "120% of market", emoji: "🔥" },
];

function ConfigurePhase({
  state,
  onApplyStrategy,
  onNext,
}: {
  state: ReturnType<typeof useListingFlow>["state"];
  onApplyStrategy: (s: PricingStrategy) => void;
  onNext: () => void;
}) {
  const photo = state.photos[state.primaryPhotoIndex];
  const comps = state.comps;
  const median = comps?.stats.soldMedian ?? null;

  function strategyPrice(id: PricingStrategy): number | null {
    if (!median) return null;
    if (id === "fast") return Math.round(median * 0.85);
    if (id === "max") return Math.round(median * 1.2);
    return Math.round(median);
  }

  return (
    <div
      className="sf-fade-up"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Photo header — 40% height */}
      <div style={{ position: "relative", height: "40%", flexShrink: 0 }}>
        {photo ? (
          <img
            src={photo.url}
            alt="Item"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#111" }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(transparent 50%, #0A0A0A 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Title + current price */}
        <div>
          <SyneHeading size={20} style={{ display: "block", marginBottom: 4 }}>
            {state.title || "SET YOUR PRICE"}
          </SyneHeading>
          {state.price && (
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "32px",
                color: "#F15A22",
                letterSpacing: "-1px",
              }}
            >
              ${state.price}
            </span>
          )}
        </div>

        {/* Comp range */}
        {comps?.stats && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {median && (
              <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>
                SOLD MEDIAN:{" "}
                <span style={{ color: "#fff" }}>${median}</span>
              </span>
            )}
            {comps.stats.activeMedian && (
              <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>
                &nbsp;· ACTIVE: <span style={{ color: "#fff" }}>${comps.stats.activeMedian}</span>
              </span>
            )}
          </div>
        )}

        {/* Strategy cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STRATEGY_CARDS.map((card) => {
            const selected = state.pricingStrategy === card.id;
            const price = strategyPrice(card.id);
            return (
              <button
                key={card.id}
                onClick={() => onApplyStrategy(card.id)}
                style={{
                  background: selected ? "rgba(241,90,34,0.12)" : "#111111",
                  border: `1.5px solid ${selected ? "#F15A22" : "#222"}`,
                  borderRadius: "12px",
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: "16px" }}>{card.emoji}</span>
                    <SyneHeading size={15} style={{ color: selected ? "#F15A22" : "#fff" }}>
                      {card.label}
                    </SyneHeading>
                  </div>
                  <p style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em", margin: 0 }}>
                    {card.sublabel}
                  </p>
                </div>
                {price && (
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 800,
                      fontSize: "24px",
                      color: selected ? "#F15A22" : "#fff",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    ${price}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {state.compsStatus === "loading" && (
          <p style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", textAlign: "center", letterSpacing: "0.1em" }}>
            <span className="sf-blink">LOADING COMPS...</span>
          </p>
        )}

        {state.compsStatus === "failed" && (
          <p style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", textAlign: "center" }}>
            Comp data unavailable. Set price manually below.
          </p>
        )}

        <OrangeButton onClick={onNext} fullWidth large>
          NEXT →
        </OrangeButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 3 — Details
───────────────────────────────────────────── */

function DetailsPhase({
  state,
  setField,
  onNext,
}: {
  state: ReturnType<typeof useListingFlow>["state"];
  setField: ReturnType<typeof useListingFlow>["setField"];
  onNext: () => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#111",
    border: "1px solid #222",
    borderRadius: "10px",
    padding: "14px 16px",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: "18px",
    outline: "none",
    letterSpacing: "-0.5px",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 400,
    fontSize: "14px",
    letterSpacing: "normal",
    resize: "none",
    minHeight: "100px",
  };

  const labelStyle: React.CSSProperties = {
    color: "#666",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
  };

  const hasAiTitle = !!state.title;
  const hasAiDesc = !!state.description;

  return (
    <div
      className="sf-fade-up"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "72px 20px 16px" }}>
        <SyneHeading size={28} style={{ display: "block" }}>
          DETAILS
        </SyneHeading>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Title */}
        <div>
          <p style={labelStyle}>
            Title {hasAiTitle && <AiBadge />}
          </p>
          <input
            style={inputStyle}
            value={state.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Item name..."
          />
        </div>

        {/* Description */}
        <div>
          <p style={labelStyle}>
            Description {hasAiDesc && <AiBadge />}
          </p>
          <textarea
            style={textareaStyle}
            value={state.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Describe the item..."
            rows={4}
          />
        </div>

        {/* Category + condition pills */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {state.category && (
            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: "8px",
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 0,
              }}
            >
              <span style={{ color: "#666", fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
                CATEGORY <AiBadge />
              </span>
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>
                {state.category}
              </span>
            </div>
          )}
          {state.condition && (
            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: "8px",
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ color: "#666", fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
                CONDITION <AiBadge />
              </span>
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>
                {formatCondition(state.condition)}
              </span>
            </div>
          )}
        </div>

        {/* Features */}
        {state.features.length > 0 && (
          <div>
            <p style={labelStyle}>
              Features <AiBadge />
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {state.features.map((f, i) => (
                <span
                  key={i}
                  style={{
                    background: "#151515",
                    border: "1px solid #222",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    color: "#aaa",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <OrangeButton onClick={onNext} fullWidth large>
          NEXT →
        </OrangeButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 4 — Shipping
───────────────────────────────────────────── */

type PackageSize = "small" | "medium" | "large";

interface PackageCard {
  id: PackageSize;
  label: string;
  sublabel: string;
  icon: string;
  maxWeight: string;
}

const PACKAGE_CARDS: PackageCard[] = [
  { id: "small", label: "SMALL", sublabel: "Envelope / poly mailer", icon: "✉️", maxWeight: "Up to 1 lb" },
  { id: "medium", label: "MEDIUM", sublabel: "Standard box", icon: "📦", maxWeight: "1–5 lbs" },
  { id: "large", label: "LARGE", sublabel: "Large box", icon: "🗃️", maxWeight: "5–20 lbs" },
];

function ShippingPhase({
  state,
  setField,
  updateWeightDims,
  onNext,
}: {
  state: ReturnType<typeof useListingFlow>["state"];
  setField: ReturnType<typeof useListingFlow>["setField"];
  updateWeightDims: ReturnType<typeof useListingFlow>["updateWeightDims"];
  onNext: () => void;
}) {
  const currentSize = (state.packageSize ?? "medium") as PackageSize;

  return (
    <div
      className="sf-fade-up"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "72px 20px 16px" }}>
        <SyneHeading size={28} style={{ display: "block" }}>
          SHIPPING
        </SyneHeading>
        <p style={{ color: "#666", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: 6, letterSpacing: "0.05em" }}>
          SELECT PACKAGE SIZE
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {PACKAGE_CARDS.map((card) => {
          const selected = currentSize === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setField("packageSize", card.id)}
              style={{
                background: selected ? "rgba(241,90,34,0.12)" : "#111111",
                border: `1.5px solid ${selected ? "#F15A22" : "#222"}`,
                borderRadius: "14px",
                padding: "20px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: "28px", lineHeight: 1 }}>{card.icon}</span>
              <div style={{ flex: 1 }}>
                <SyneHeading size={16} style={{ color: selected ? "#F15A22" : "#fff", display: "block", marginBottom: 4 }}>
                  {card.label}
                </SyneHeading>
                <p style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", margin: 0, letterSpacing: "0.05em" }}>
                  {card.sublabel}
                </p>
                <p style={{ color: "#444", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", margin: "2px 0 0", letterSpacing: "0.05em" }}>
                  {card.maxWeight}
                </p>
              </div>
              {selected && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#F15A22" strokeWidth="1.5" />
                  <path d="M6 10l3 3 5-5" stroke="#F15A22" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Weight + dimensions */}
        <div style={{ marginTop: 8 }}>
          <WeightDimsInputsInline
            value={{
              weight: state.weight,
              dimLength: state.dimLength,
              dimWidth: state.dimWidth,
              dimHeight: state.dimHeight,
              ebayPackageType: state.ebayPackageType,
            }}
            onChange={updateWeightDims}
            estimated={state.weightEstimated}
            tokens={{ text: "#fff", secondary: "#666", cardBg: "#111", cardBorder: "#222" }}
            labelStyleOverride={{
              color: "#666",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <OrangeButton onClick={onNext} fullWidth large>
            NEXT →
          </OrangeButton>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 5 — Review
───────────────────────────────────────────── */

const MARKETPLACE_CYCLE: Array<"ebay" | "reverb"> = ["ebay", "reverb"];

export function ReviewPhase({
  state,
  setField,
  onPublish,
  updatePhoto,
}: {
  state: ReturnType<typeof useListingFlow>["state"];
  setField: ReturnType<typeof useListingFlow>["setField"];
  onPublish: (publishMode: "draft" | "live") => void;
  updatePhoto: ReturnType<typeof useListingFlow>["updatePhoto"];
}) {
  const [publishMode, setPublishMode] = useState<"draft" | "live">("live");
  const photoEdit = usePhotoEdit(state.photos, updatePhoto);

  function cycleMarketplace() {
    const idx = MARKETPLACE_CYCLE.indexOf(state.marketplace);
    const next = MARKETPLACE_CYCLE[(idx + 1) % MARKETPLACE_CYCLE.length];
    setField("marketplace", next);
  }

  const MARKETPLACE_COLORS: Record<string, string> = {
    ebay: "#E53238",
    reverb: "#0D6EFD",
  };

  const rows = [
    { label: "TITLE", value: state.title },
    { label: "CONDITION", value: state.condition ? formatCondition(state.condition) : "—" },
    { label: "CATEGORY", value: state.category || "—" },
    { label: "PACKAGE", value: (state.packageSize ?? "medium").toUpperCase() },
    state.weight ? { label: "WEIGHT", value: `${state.weight} lbs` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div
      className="sf-fade-up"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Photo gallery strip — tap a thumb to open the editor overlay (S2.5-9). */}
      <div style={{ padding: "72px 20px 16px", flexShrink: 0 }}>
        <PhotoGalleryStrip
          photos={state.photos.map((p) => ({ key: p.key, url: p.url, editable: !p.url.startsWith("blob:") }))}
          onEditPhoto={photoEdit.openEditor}
          maxPhotos={12}
        />
      </div>

      <PhotoEditOverlay photoEdit={photoEdit} photoCount={state.photos.length} alt={state.title || "Photo preview"} />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Price */}
        {state.price && (
          <div
            style={{
              background: "#151515",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
              PRICE
            </span>
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "32px",
                color: "#F15A22",
                letterSpacing: "-1px",
              }}
            >
              ${state.price}
            </span>
          </div>
        )}

        {/* Marketplace toggle */}
        <button
          onClick={cycleMarketplace}
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: "12px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
            MARKETPLACE
          </span>
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: "16px",
              color: MARKETPLACE_COLORS[state.marketplace] ?? "#fff",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {state.marketplace.toUpperCase()}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
              <path d="M3 5.5L7 9l4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {/* Quantity stepper */}
        <div
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: "12px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#666", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
            QUANTITY
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button
              onClick={() => setField("quantity", Math.max(1, state.quantity - 1))}
              disabled={state.quantity <= 1}
              style={{ width: 32, height: 32, borderRadius: "8px", border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontSize: 20, cursor: state.quantity <= 1 ? "not-allowed" : "pointer", opacity: state.quantity <= 1 ? 0.4 : 1 }}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span style={{ minWidth: 24, textAlign: "center", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "20px", color: "#fff" }}>
              {state.quantity}
            </span>
            <button
              onClick={() => setField("quantity", state.quantity + 1)}
              style={{ width: 32, height: 32, borderRadius: "8px", border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontSize: 20, cursor: "pointer" }}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        {/* Summary rows */}
        <div
          style={{
            background: "#111",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "12px 16px",
                borderBottom: i < rows.length - 1 ? "1px solid #1a1a1a" : "none",
                gap: 12,
              }}
            >
              <span style={{ color: "#666", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", flexShrink: 0 }}>
                {row.label}
              </span>
              <span style={{ color: "#fff", fontSize: "13px", textAlign: "right", lineHeight: 1.4 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Fee estimate */}
        {state.price && (
          <div
            style={{
              background: "#111",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <FeeEstimate price={state.price} marketplace={state.marketplace} />
          </div>
        )}

        {/* Publish mode toggle */}
        <div style={{ display: "flex", gap: 8, padding: 4, background: "#111", border: "1px solid #222", borderRadius: "12px" }}>
          {(["live", "draft"] as const).map((mode) => {
            const selected = publishMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setPublishMode(mode)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: "9px",
                  border: "none",
                  background: selected ? "#F15A22" : "transparent",
                  color: selected ? "#fff" : "#888",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {mode === "live" ? "Publish Live" : "Save Draft"}
              </button>
            );
          })}
        </div>

        {/* Publish */}
        <OrangeButton onClick={() => onPublish(publishMode)} fullWidth large>
          {publishMode === "draft" ? "SAVE DRAFT" : "PUBLISH NOW"}
        </OrangeButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 6 — Publishing
───────────────────────────────────────────── */

function PublishingPhase() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {/* Spinning ring */}
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <svg
          className="sf-spin"
          width="80"
          height="80"
          viewBox="0 0 80 80"
          style={{ position: "absolute", inset: 0 }}
        >
          <circle cx="40" cy="40" r="36" stroke="#222" strokeWidth="4" fill="none" />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="#F15A22"
            strokeWidth="4"
            fill="none"
            strokeDasharray="60 166"
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F15A22" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <SyneHeading size={26} style={{ display: "block", marginBottom: 8 }}>
          <span className="sf-blink">PUBLISHING...</span>
        </SyneHeading>
        <p style={{ color: "#666", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", letterSpacing: "0.1em" }}>
          SENDING TO MARKETPLACE
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main SwipeFlow component
───────────────────────────────────────────── */

export function SwipeFlow({ itemId }: SwipeFlowProps) {
  const flow = useListingFlow();
  const prepareListing = usePrepareListing();
  const { state, setField, updateWeightDims, startFromItem, confirmRecognition, fetchComps, applyPricingStrategy, publish, reset } = flow;

  const [phase, setPhase] = useState<Phase>("recognition");
  const [scanPercent, setScanPercent] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedComps = useRef(false);

  // On mount: if itemId provided, start from item
  useEffect(() => {
    if (itemId) {
      startFromItem(itemId).then(() => {
        setPhase("configure");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // When recognition status changes, update phase
  useEffect(() => {
    if (state.recognition.status === "recognizing") {
      // Animate scan percent
      setScanPercent(0);
      scanIntervalRef.current = setInterval(() => {
        setScanPercent((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.floor(Math.random() * 8) + 2;
        });
      }, 300);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (state.recognition.status === "complete" && phase === "recognition") {
        setScanPercent(100);
      }
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recognition.status]);

  // Fetch comps when entering configure phase
  useEffect(() => {
    if (phase === "configure" && !hasFetchedComps.current && state.inventoryItemId) {
      hasFetchedComps.current = true;
      fetchComps();
    }
  }, [phase, fetchComps, state.inventoryItemId]);

  const goBack = useCallback(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx > 0) setPhase(PHASE_ORDER[idx - 1]);
  }, [phase]);

  // Pre-fill weight/dims from the AI estimate (guarded — never clobbers a weight
  // the seller already entered).
  useEffect(() => {
    const ebay = prepareListing.data?.ebay;
    if (ebay) flow.applyEstimatedWeightDims(ebayEstimateToWeightDims(ebay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareListing.data]);

  const handleConfirmRecognition = useCallback(() => {
    confirmRecognition(state.recognition.selectedIndex);
    if (state.inventoryItemId) {
      prepareListing.prepare(state.inventoryItemId, ['ebay']);
    }
    setPhase("configure");
  }, [confirmRecognition, state.recognition.selectedIndex, state.inventoryItemId, prepareListing]);

  const handleApplyStrategy = useCallback(
    (s: PricingStrategy) => {
      applyPricingStrategy(s);
    },
    [applyPricingStrategy]
  );

  const [aspectsNeeded, setAspectsNeeded] = useState<AspectRequirement[] | null>(null);
  const [aspectSaving, setAspectSaving] = useState(false);
  const [aspectError, setAspectError] = useState<string | null>(null);
  const [weightNeeded, setWeightNeeded] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const pendingPublishOpts = useRef<PublishOpts | undefined>(undefined);

  const runPublish = useCallback(async (opts?: PublishOpts) => {
    const fillingAspects = !!opts?.aspects;
    const fillingWeight = !!opts?.weightDims;
    setPublishError(null);
    setAspectError(null);
    setWeightError(null);
    if (fillingAspects) setAspectSaving(true);
    else if (fillingWeight) setWeightSaving(true);
    else setPhase("publishing");

    const result = await publish(opts);

    if (fillingAspects) setAspectSaving(false);
    else if (fillingWeight) setWeightSaving(false);

    if (result.success) {
      setAspectsNeeded(null);
      setWeightNeeded(false);
      setPhase("success");
    } else if (result.aspectsRequired) {
      pendingPublishOpts.current = opts;
      setAspectsNeeded(result.aspectsRequired);
      if (fillingAspects) setAspectError("eBay needs a few more details to publish.");
      else setPhase("review");
    } else if (result.weightRequired) {
      pendingPublishOpts.current = opts;
      setWeightNeeded(true);
      if (fillingWeight) setWeightError("Add the package weight and dimensions to continue.");
      else setPhase("review");
    } else if (fillingAspects) {
      setAspectError(result.error ?? "Publishing failed");
    } else if (fillingWeight) {
      setWeightError(result.error ?? "Publishing failed");
    } else {
      setPublishError(result.error ?? "Publishing failed");
      setPhase("review");
    }
  }, [publish]);

  const handlePublish = useCallback((publishMode: "draft" | "live") => {
    runPublish({ ebayPreparedFields: prepareListing.data?.ebay ?? null, publishMode });
  }, [runPublish, prepareListing.data]);

  const handleListAnother = useCallback(() => {
    reset();
    hasFetchedComps.current = false;
    setPhase("recognition");
  }, [reset]);

  const isScanning = state.recognition.status === "recognizing";

  return (
    <div
      style={
        {
          "--flow-bg": "#0A0A0A",
          "--flow-text": "#FFFFFF",
          "--flow-accent": "#F15A22",
          position: "fixed",
          inset: 0,
          background: "#0A0A0A",
          color: "#fff",
          overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        } as React.CSSProperties
      }
    >
      <GlobalStyles />

      {/* Loading overlay during scan */}
      {isScanning && <LoadingOverlay percent={Math.min(scanPercent, 99)} />}

      {/* Progress dots (not shown during publishing/success) */}
      {phase !== "publishing" && phase !== "success" && (
        <ProgressDots
          phase={phase}
          onBack={phase !== "recognition" ? goBack : undefined}
        />
      )}

      {/* Phase content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflowY: phase === "recognition" ? "hidden" : "auto",
        }}
      >
        {phase === "recognition" && (
          <RecognitionPhase
            state={state}
            onConfirm={handleConfirmRecognition}
            onRetry={() => {
              reset();
              setPhase("recognition");
            }}
            onScan={() => setShowCapture(true)}
          />
        )}

        {phase === "configure" && (
          <ConfigurePhase
            state={state}
            onApplyStrategy={handleApplyStrategy}
            onNext={() => setPhase("details")}
          />
        )}

        {phase === "details" && (
          <DetailsPhase
            state={state}
            setField={setField}
            onNext={() => setPhase("shipping")}
          />
        )}

        {phase === "shipping" && (
          <ShippingPhase
            state={state}
            setField={setField}
            updateWeightDims={updateWeightDims}
            onNext={() => setPhase("review")}
          />
        )}

        {phase === "review" && (
          <>
            <ReviewPhase
              state={state}
              setField={setField}
              onPublish={handlePublish}
              updatePhoto={flow.updatePhoto}
            />
            {publishError && (
              <div
                style={{
                  position: "fixed",
                  bottom: 100,
                  left: 20,
                  right: 20,
                  background: "rgba(180,20,20,0.9)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  zIndex: 50,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                {publishError}
              </div>
            )}
          </>
        )}

        {phase === "publishing" && <PublishingPhase />}

        {phase === "success" && state.listingId && (
          <div
            className="sf-fade-up"
            style={{ paddingTop: "env(safe-area-inset-top, 40px)" }}
          >
            <PublishSuccess
              listingId={state.listingId}
              warning={state.publishWarning ?? undefined}
              marketplace={state.marketplace}
              title={state.title}
              price={state.price ?? 0}
              photoUrl={state.photos[state.primaryPhotoIndex]?.url ?? null}
              isFirstListing={false}
              onListAnother={handleListAnother}
            />
          </div>
        )}
      </div>

      <PhotoCaptureOverlay
        show={showCapture}
        onPhotos={(photos) => flow.startFromPhoto(photos)}
        onCancel={() => setShowCapture(false)}
      />

      {aspectsNeeded && (
        <AspectFillSheet
          missing={aspectsNeeded}
          initial={{
            ...(state.brand ? { Brand: [state.brand] } : {}),
            ...(state.model ? { Model: [state.model] } : {}),
          }}
          saving={aspectSaving}
          error={aspectError}
          onCancel={() => {
            setAspectsNeeded(null);
            setAspectError(null);
          }}
          onSave={(aspects) => runPublish({ ...pendingPublishOpts.current, aspects })}
        />
      )}

      {weightNeeded && (
        <WeightFillSheet
          initial={{
            weight: state.weight,
            dimLength: state.dimLength,
            dimWidth: state.dimWidth,
            dimHeight: state.dimHeight,
            ebayPackageType: state.ebayPackageType,
          }}
          saving={weightSaving}
          error={weightError}
          onCancel={() => {
            setWeightNeeded(false);
            setWeightError(null);
          }}
          onSave={(value) => runPublish({ ...pendingPublishOpts.current, weightDims: value })}
        />
      )}
    </div>
  );
}
