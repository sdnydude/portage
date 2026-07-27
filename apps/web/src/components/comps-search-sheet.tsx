"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import type { CompResult } from "@portage/shared";

interface CompsSearchSheetProps {
  onClose: () => void;
}

function formatPrice(n: number) {
  return "$" + n.toFixed(0);
}

export function CompsSearchSheet({ onClose }: CompsSearchSheetProps) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await api<CompResult>(
        `/items/comps/search?q=${encodeURIComponent(q)}`,
        { token: token ?? undefined }
      );
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const hasResults = results && (results.sold.length > 0 || results.active.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full rounded-t-3xl bg-[var(--background)] border-t border-[var(--border)]"
        style={{
          animation: "slide-up 0.28s ease-out",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex-1">
            <p className="font-[family-name:var(--font-instrument)] font-bold text-text-primary text-base">
              eBay Price Check
            </p>
            <p className="text-text-secondary text-xs">Sold &amp; active listings</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Gibson Les Paul Standard 2019"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-placeholder)]"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="flex-shrink-0 flex items-center justify-center h-8 px-4 rounded-full bg-[var(--forest-green)] text-white text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              "Search"
            )}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)" }}
        >
          {error && (
            <div className="px-4 py-4 text-sm text-red-500">{error}</div>
          )}

          {!results && !isLoading && !error && (
            <div className="px-4 py-8 text-center text-text-secondary text-sm">
              Search any item to see what it&apos;s selling for on eBay
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-[var(--forest-green)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {results && !isLoading && (
            <div className="px-4 pt-3 space-y-4">
              {/* Stats banner */}
              {results.stats.soldMedian != null && (
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-4"
                  style={{ background: "color-mix(in srgb, var(--forest-green) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--forest-green) 20%, transparent)" }}
                >
                  <div className="text-center flex-1">
                    <p className="font-[family-name:var(--font-jetbrains)] font-bold text-[var(--forest-green)] text-xl">
                      {formatPrice(results.stats.soldMedian)}
                    </p>
                    <p className="text-text-secondary text-xs mt-0.5">Sold median</p>
                  </div>
                  {results.stats.soldAvg != null && (
                    <div className="text-center flex-1 border-l border-[var(--border)] pl-4">
                      <p className="font-[family-name:var(--font-jetbrains)] font-bold text-text-primary text-xl">
                        {formatPrice(results.stats.soldAvg)}
                      </p>
                      <p className="text-text-secondary text-xs mt-0.5">Sold avg</p>
                    </div>
                  )}
                  <div className="text-center flex-1 border-l border-[var(--border)] pl-4">
                    <p className="font-[family-name:var(--font-jetbrains)] font-bold text-text-primary text-xl">
                      {results.stats.sampleSize}
                    </p>
                    <p className="text-text-secondary text-xs mt-0.5">Comps</p>
                  </div>
                </div>
              )}

              {!hasResults && (
                <p className="text-center text-text-secondary text-sm py-4">
                  No results found — try a broader search
                </p>
              )}

              {/* Sold listings */}
              {results.sold.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    Sold ({results.sold.length})
                  </p>
                  <div className="space-y-1">
                    {results.sold.map((listing, i) => (
                      <a
                        key={i}
                        href={listing.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface)] transition-colors group"
                      >
                        {listing.imageUrl && (
                          <img
                            src={listing.imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-muted"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate leading-snug">{listing.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5 capitalize">{listing.condition}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-[family-name:var(--font-jetbrains)] font-semibold text-[var(--forest-green)] text-sm">
                            {formatPrice(listing.price)}
                          </p>
                          {listing.soldDate && (
                            <p className="text-[10px] text-text-secondary">
                              {new Date(listing.soldDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 text-text-placeholder flex-shrink-0 group-hover:text-text-secondary transition-colors">
                          <path strokeLinecap="round" d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Active listings */}
              {results.active.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    Active ({results.active.length})
                  </p>
                  <div className="space-y-1">
                    {results.active.map((listing, i) => (
                      <a
                        key={i}
                        href={listing.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface)] transition-colors group"
                      >
                        {listing.imageUrl && (
                          <img
                            src={listing.imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-muted"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate leading-snug">{listing.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5 capitalize">{listing.condition}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-[family-name:var(--font-jetbrains)] font-semibold text-text-primary text-sm">
                            {formatPrice(listing.price)}
                          </p>
                        </div>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 text-text-placeholder flex-shrink-0 group-hover:text-text-secondary transition-colors">
                          <path strokeLinecap="round" d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
