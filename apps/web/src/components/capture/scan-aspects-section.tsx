"use client";

import { useEffect, useRef, useState } from "react";
import type { RequiredAspect } from "@/hooks/use-required-aspects";

/**
 * Above this many allowed values a chip wall stops being scannable (eBay's
 * Brand lists run to hundreds) — fall back to a text input and let the AI
 * suggestion chips carry the common cases.
 */
const CHIP_LIST_MAX = 30;

interface ScanAspectsSectionProps {
  aspects: Record<string, RequiredAspect>;
  aspectValues: Record<string, string>;
  setAspectValue: (name: string, value: string) => void;
  /** AI-seeded values per aspect name; confirmed names already excluded. */
  suggestions: Record<string, string[]>;
  confirmSuggestion: (name: string, value: string) => void;
  missingRequired: string[];
  isCategoryResolving: boolean;
  isAspectsLoading: boolean;
  categoryResolved: boolean;
}

/**
 * Inline eBay Item Specifics editor for the scan review panel — captures
 * required specifics at scan time instead of failing at publish.
 */
export function ScanAspectsSection({
  aspects,
  aspectValues,
  setAspectValue,
  suggestions,
  confirmSuggestion,
  missingRequired,
  isCategoryResolving,
  isAspectsLoading,
  categoryResolved,
}: ScanAspectsSectionProps) {
  // Collapsed by default; required-missing blocks publish, so the section
  // opens itself (and stays user-toggleable afterwards).
  const [expanded, setExpanded] = useState(missingRequired.length > 0);
  const [showOptional, setShowOptional] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  // Tracks the blocked state across renders so auto-expand fires once per
  // transition into "required missing", not on every keystroke while blocked.
  const wasBlockedRef = useRef(missingRequired.length > 0);
  const missingSet = new Set(missingRequired);
  const isLoading = isCategoryResolving || isAspectsLoading;

  useEffect(() => {
    const blocked = !isCategoryResolving && !isAspectsLoading && missingRequired.length > 0;
    if (blocked && !wasBlockedRef.current) {
      setExpanded(true);
      // jsdom has no scrollIntoView — optional call keeps tests honest.
      sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
    wasBlockedRef.current = blocked;
  }, [isCategoryResolving, isAspectsLoading, missingRequired.length]);

  if (isLoading) {
    return (
      <div ref={sectionRef} className="space-y-2" aria-busy="true" aria-label="Loading eBay item specifics">
        <div className="h-4 w-40 rounded-md bg-border/40 animate-shimmer" />
        <div className="h-11 rounded-xl bg-border/40 animate-shimmer" />
        <div className="h-11 rounded-xl bg-border/40 animate-shimmer" />
      </div>
    );
  }

  // Unresolved category is not an error — specifics get collected by the
  // existing publish-gate sheet at listing time instead.
  if (!categoryResolved) {
    return (
      <div ref={sectionRef}>
        <p className="text-xs text-text-secondary">
          eBay item specifics will be captured at listing time (category unresolved).
        </p>
      </div>
    );
  }

  const renderAspect = (name: string, aspect: RequiredAspect) => {
    const value = aspectValues[name] ?? "";
    const isMissing = missingSet.has(name);
    const aspectSuggestions = suggestions[name] ?? [];

    return (
      <div key={name} className="space-y-1.5">
        <label
          className={`text-xs font-medium ${
            isMissing ? "text-[var(--accent-error)]" : "text-text-secondary"
          }`}
        >
          {name}
          {aspect.required && <span aria-hidden="true"> *</span>}
          {isMissing && <span className="sr-only"> (required, not filled)</span>}
        </label>

        {aspect.values && aspect.values.length > 0 && aspect.values.length <= CHIP_LIST_MAX ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
            {aspect.values.map((v) => {
              const selected = value === v;
              const suggested = !selected && aspectSuggestions.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAspectValue(name, selected ? "" : v)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-[var(--teal)] text-white border-[var(--teal)]"
                      : suggested
                        ? "border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]"
                        : isMissing
                          ? "border-[var(--accent-error)]/40 text-text-primary hover:bg-background"
                          : "border-border text-text-primary hover:bg-background"
                  }`}
                >
                  {suggested ? `✨ ${v}` : v}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => setAspectValue(name, e.target.value)}
              // iOS: keep the focused field visible above the keyboard.
              onFocus={(e) => e.target.scrollIntoView?.({ behavior: "smooth", block: "center" })}
              placeholder={`Enter ${name}`}
              aria-required={aspect.required}
              aria-invalid={isMissing}
              className={`w-full min-h-[44px] px-3 py-2 rounded-xl bg-background border text-text-primary text-sm focus:outline-none ${
                isMissing
                  ? "border-[var(--accent-error)] focus:border-[var(--accent-error)]"
                  : "border-border focus:border-border-focus"
              }`}
            />
            {value.trim() === "" && aspectSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label={`AI suggestions for ${name}`}>
                {aspectSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => confirmSuggestion(name, s)}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)] transition-colors hover:bg-[var(--teal)] hover:text-white"
                  >
                    ✨ {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const entries = Object.entries(aspects);
  const requiredEntries = entries.filter(([, a]) => a.required);
  const optionalEntries = entries.filter(([, a]) => !a.required);

  return (
    <div ref={sectionRef} className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((p) => !p)}
        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-text-primary">eBay item specifics</span>
        <span className="flex items-center gap-2">
          {missingRequired.length > 0 ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent-error-soft)] text-[var(--accent-error)]">
              {missingRequired.length} required
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent-success-soft)] text-[var(--accent-success)]">
              Complete
            </span>
          )}
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-4 border-t border-border pt-3">
          {requiredEntries.map(([name, aspect]) => renderAspect(name, aspect))}
          {optionalEntries.length > 0 &&
            (showOptional ? (
              optionalEntries.map(([name, aspect]) => renderAspect(name, aspect))
            ) : (
              <button
                type="button"
                onClick={() => setShowOptional(true)}
                className="text-xs font-medium text-[var(--teal)] min-h-[44px] flex items-center"
              >
                Show {optionalEntries.length} optional detail
                {optionalEntries.length === 1 ? "" : "s"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
