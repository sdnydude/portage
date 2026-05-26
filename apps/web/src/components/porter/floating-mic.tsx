"use client";

import { useState } from "react";
import { BottomSheet } from "./bottom-sheet";

export function FloatingMic() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-40 flex items-center justify-center rounded-full bg-[var(--forest-green)] text-white active:scale-95 transition-transform"
        style={{
          bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
          right: "18px",
          width: "52px",
          height: "52px",
          boxShadow: "0 4px 20px rgba(45,90,39,0.35), 0 0 0 3px var(--background)",
        }}
        aria-label="Open Porter voice assistant"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
          <path strokeLinecap="round" d="M19 10a7 7 0 0 1-14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>

      {isOpen && <BottomSheet onClose={() => setIsOpen(false)} />}
    </>
  );
}
