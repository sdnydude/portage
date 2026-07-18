"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-send the ?q= message once when landing on /porter from an
 * AskPorterBar submit, then strip the param so back-nav/re-render
 * can't re-send. Reads window.location (not useSearchParams) to avoid
 * the client-page Suspense requirement.
 */
export function usePorterAutosend(send: (text: string) => void): void {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim();
    if (!q) return;
    fired.current = true;
    params.delete("q");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    send(q);
  }, [send]);
}
