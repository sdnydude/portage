"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SoldCelebrationProps {
  orderId: string;
  itemTitle: string;
  salePrice: number;
  buyerUsername: string;
  marketplace: "ebay" | "etsy";
  onDismiss: () => void;
}

const CONFETTI_COLORS = [
  "#2D5A27", "#4CAF50", "#66BB6A", "#D4A574",
  "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899",
];

// Deterministic pseudo-random from index to avoid impure render calls
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function ConfettiPiece({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const leftPct = seededRandom(index * 4 + 0) * 100;
  const delay = seededRandom(index * 4 + 1) * 2;
  const duration = 2 + seededRandom(index * 4 + 2) * 2;
  const size = 6 + seededRandom(index * 4 + 3) * 6;

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        left: `${leftPct}%`,
        width: `${size}px`,
        height: `${size * 0.6}px`,
        backgroundColor: color,
        borderRadius: "2px",
        animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
        opacity: 0,
        animationFillMode: "forwards",
      }}
    />
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getMarketplaceLabel(marketplace: "ebay" | "etsy"): string {
  return marketplace === "ebay" ? "eBay" : "Etsy";
}

export function SoldCelebration({
  orderId,
  itemTitle,
  salePrice,
  buyerUsername,
  marketplace,
  onDismiss,
}: SoldCelebrationProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const handleShipIt = useCallback(() => {
    onDismiss();
    router.push(`/orders/${orderId}/ship`);
  }, [onDismiss, orderId, router]);

  // Generate confetti pieces (set seed for SSR consistency)
  const confettiPieces = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-label="Item sold celebration"
    >
      {/* Dark glass backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(var(--glass-thick-blur, 30px)) saturate(180%)",
          WebkitBackdropFilter: "blur(var(--glass-thick-blur, 30px)) saturate(180%)",
          background: "rgba(0, 0, 0, 0.75)",
        }}
        onClick={onDismiss}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confettiPieces.map((i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-sm mx-auto animate-spring-in">
        {/* Checkmark circle */}
        <div
          className="w-24 h-24 rounded-full bg-forest-green flex items-center justify-center mx-auto mb-6"
          style={{ boxShadow: "0 0 60px rgba(45, 90, 39, 0.4)" }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" className="animate-check-draw" />
          </svg>
        </div>

        {/* Sale price */}
        <p
          className="font-[family-name:var(--font-instrument)] font-bold text-white mb-1"
          style={{ fontSize: "2.5rem", lineHeight: 1.1 }}
        >
          {formatCurrency(salePrice)}
        </p>

        <p className="text-white/60 text-sm mb-2">SOLD</p>

        {/* Item title */}
        <p className="text-white/90 text-base font-medium mb-1 line-clamp-2">
          {itemTitle}
        </p>

        {/* Buyer and marketplace */}
        <p className="text-white/50 text-sm mb-8">
          to {buyerUsername} on {getMarketplaceLabel(marketplace)}
        </p>

        {/* Ship It CTA */}
        <button
          onClick={handleShipIt}
          className="w-full py-4 rounded-2xl bg-white text-forest-green-dark font-bold text-base transition-transform active:scale-[0.98]"
          style={{ boxShadow: "var(--shadow-floating)" }}
        >
          Ship It
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="mt-4 text-white/40 text-sm font-medium hover:text-white/60 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
