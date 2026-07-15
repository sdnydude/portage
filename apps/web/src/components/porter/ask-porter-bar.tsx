"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { porterPills } from "@/lib/navigation";

/**
 * Focus-expanding Ask Porter input. One component, two mounts:
 * desktop TopBar center, and under PageHeader on inventory/listings/orders
 * below lg. Collapsed ~44px; focus grows it to 3 rows and reveals
 * page-specific pills. Submit routes to /porter?q=… (auto-send there).
 */
export function AskPorterBar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const expanded = focused || value.length > 0;
  const pills = porterPills(pathname);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setValue("");
    setFocused(false);
    router.push(`/porter?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="w-full max-w-xl">
      <div
        className="flex items-end gap-2 rounded-2xl border bg-surface px-3 py-1.5"
        style={{ borderColor: expanded ? "var(--teal)" : "var(--border)" }}
      >
        <svg className="mb-2 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a7 7 0 017 7v3a7 7 0 01-14 0V9a7 7 0 017-7z" />
          <circle cx="9" cy="11" r="1" />
          <circle cx="15" cy="11" r="1" />
        </svg>
        <textarea
          aria-label="Ask Porter"
          placeholder="Ask Porter…"
          rows={expanded ? 3 : 1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-lg bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)]"
        />
        {expanded && (
          <button
            onMouseDown={(e) => e.preventDefault()} // keep textarea focus through the click
            onClick={() => submit(value)}
            aria-label="Send to Porter"
            className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: "var(--teal)" }}
            disabled={!value.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <button
              key={pill}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(pill)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-[var(--teal)] hover:text-text-primary"
            >
              {pill}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
