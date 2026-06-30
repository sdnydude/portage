"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useResearch, type ResearchMissingAspect } from "@/hooks/use-research";
import { demandLabel } from "@/lib/demand";

interface ListingOptimizerPanelProps {
  itemId: string;
  /** Called after an aspect is filled, so the parent can refresh the item. */
  onFilled?: () => void;
}

const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n)}`);

export function ListingOptimizerPanel({ itemId, onFilled }: ListingOptimizerPanelProps) {
  const { token } = useAuth();
  const { research, isLoading, error, refetch } = useResearch(itemId);
  const [pending, setPending] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fill = useCallback(async (name: string, value: string) => {
    const v = value.trim();
    if (!v || !token) return;
    setPending(name);
    setFillError(null);
    try {
      // Merge-PATCH the aspect; the item-edit sync then pushes it to the live
      // eBay listing automatically (apps/api items PATCH → updateListing).
      await api(`/items/${itemId}`, { method: "PATCH", body: { aspects: { [name]: [v] } }, token });
      setDrafts((d) => ({ ...d, [name]: "" }));
      await refetch();
      onFilled?.();
    } catch (err) {
      setFillError(err instanceof ApiError ? err.message : `Couldn't save ${name}`);
    } finally {
      setPending(null);
    }
  }, [api, itemId, token, refetch, onFilled]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface/50 p-4 flex items-center gap-2 text-sm text-text-secondary">
        <div className="w-4 h-4 border-2 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
        Analyzing eBay demand & item specifics…
      </div>
    );
  }
  if (error || !research) {
    return (
      <div className="rounded-2xl border border-border bg-surface/50 p-4 text-sm text-text-secondary">
        {error ?? "Optimizer data is unavailable right now."}
      </div>
    );
  }

  const { category, aspects, demand, traffic } = research;
  const demandTag = demandLabel(demand?.sellThrough ?? null);
  const requiredMissing = aspects.missing.filter((a) => a.required).length;

  return (
    <section className="rounded-2xl border border-border bg-surface/50 overflow-hidden">
      <header className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Listing Optimizer
          </h3>
          {category && (
            <p className="text-xs text-text-secondary mt-0.5">eBay category · {category.categoryName}</p>
          )}
        </div>
        {demandTag && (
          <span
            className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: demandTag === "Hot" ? "rgba(45,90,39,0.12)" : demandTag === "Slow" ? "rgba(204,51,51,0.10)" : "rgba(0,0,0,0.05)",
              color: demandTag === "Hot" ? "#2D5A27" : demandTag === "Slow" ? "#CC3333" : "var(--text-secondary)",
            }}
          >
            {demandTag === "Hot" ? "🔥 In demand" : demandTag === "Slow" ? "Slow mover" : "Steady"}
          </span>
        )}
      </header>

      {/* Item specifics buyers filter on */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Item specifics buyers filter on</p>
          {aspects.missing.length > 0 && (
            <span className="text-xs text-text-secondary">
              {aspects.missing.length} missing{requiredMissing > 0 ? ` · ${requiredMissing} required` : ""}
            </span>
          )}
        </div>

        {fillError && <p className="text-xs text-red-500 mb-2">{fillError}</p>}

        <div className="space-y-2">
          {aspects.missing.map((a) => (
            <MissingAspectRow
              key={a.name}
              aspect={a}
              pending={pending === a.name}
              draft={drafts[a.name] ?? ""}
              onDraft={(v) => setDrafts((d) => ({ ...d, [a.name]: v }))}
              onFill={(value) => fill(a.name, value)}
            />
          ))}

          {aspects.filled.map((a) => (
            <div key={a.name} className="flex items-center gap-2 text-sm py-1">
              <span className="text-[var(--forest-green,#2D5A27)] shrink-0" aria-hidden>✓</span>
              <span className="text-text-secondary">{a.name}</span>
              <span className="text-text-primary font-medium truncate">{a.values.join(", ")}</span>
            </div>
          ))}

          {aspects.missing.length === 0 && aspects.filled.length === 0 && (
            <p className="text-sm text-text-secondary">No category specifics available yet.</p>
          )}
        </div>
      </div>

      {/* Market demand */}
      {demand && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary mb-2">Market demand</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Sold" value={String(demand.soldCount)} />
            <Stat label="Active" value={String(demand.activeCount)} />
            <Stat label="Median" value={money(demand.soldMedian ?? demand.activeMedian)} />
          </div>
          {demand.sellThrough != null && (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(demand.sellThrough * 100)}%`, background: "var(--teal, #2D5A27)" }}
                />
              </div>
              <p className="text-xs text-text-secondary mt-1">{Math.round(demand.sellThrough * 100)}% sell-through</p>
            </div>
          )}
        </div>
      )}

      {/* Performance (Analytics) */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary mb-2">Performance</p>
        {traffic ? (
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="Impressions" value={traffic.impressions != null ? traffic.impressions.toLocaleString() : "—"} />
            <Stat label="Click rate" value={traffic.clickThroughRate != null ? `${traffic.clickThroughRate}%` : "—"} />
            <Stat label="Views" value={traffic.views != null ? traffic.views.toLocaleString() : "—"} />
            <Stat label="Sales" value={traffic.transactions != null ? String(traffic.transactions) : "—"} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Reconnect your eBay account to see impressions, views, and click-through for this listing.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] py-2">
      <p className="text-sm font-semibold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

function MissingAspectRow({
  aspect,
  pending,
  draft,
  onDraft,
  onFill,
}: {
  aspect: ResearchMissingAspect;
  pending: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onFill: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--amber,#B8860B)]/30 bg-[var(--amber,#B8860B)]/[0.06] px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber,#B8860B)] shrink-0" aria-hidden />
        <span className="text-sm font-medium text-text-primary">{aspect.name}</span>
        {aspect.required && (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--amber,#B8860B)]/15 text-[var(--amber,#B8860B)]">
            Required
          </span>
        )}
      </div>
      {aspect.suggestedValues && aspect.suggestedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {aspect.suggestedValues.slice(0, 8).map((v) => (
            <button
              key={v}
              type="button"
              disabled={pending}
              onClick={() => onFill(v)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-text-primary hover:border-[var(--teal)] disabled:opacity-50 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onFill(draft); }}
            placeholder={`Add ${aspect.name}`}
            className="flex-1 text-xs px-2.5 py-1 rounded-lg border border-border bg-surface text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]/40 focus:border-[var(--teal)]"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={() => onFill(draft)}
            className="text-xs px-3 py-1 rounded-lg bg-[var(--teal,#2D5A27)] text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
