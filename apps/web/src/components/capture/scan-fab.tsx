"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ScanFlow } from "./scan-flow";

export function ScanFab() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-40 right-4 bg-forest-green text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-forest-green-light active:scale-95 transition-all"
        style={{ bottom: "calc(5rem + var(--safe-area-bottom) + 0.75rem)" }}
        aria-label="Scan item"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>

      {isOpen && <ScanFlow onClose={() => setIsOpen(false)} />}
    </>
  );
}
