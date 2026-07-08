"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface BillingStatus {
  effectiveTier: "free" | "pro" | "beta-tester";
  trial: { active: boolean; endsAt: string } | null;
  subscription: { id: string; plan: "monthly" | "annual" } | null;
  usage: {
    aiListings: { used: number; limit: number; credits: number };
    bgRemovals: { used: number; limit: number | null };
    porterExchanges: { limit: number };
    marketplaces: { limit: number | null };
  };
}

function UsageBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-sm font-medium">Unlimited</span>
      </div>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const isNearLimit = pct >= 80;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
        <span className={`text-sm font-medium ${isNearLimit ? "text-amber-600" : ""}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? "bg-amber-500" : "bg-[var(--color-primary)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TrialBanner({ endsAt }: { endsAt: string }) {
  const [daysLeft] = useState(() => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))));

  return (
    <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-[var(--color-primary)]">Pro Trial Active</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {daysLeft} {daysLeft === 1 ? "day" : "days"} left
        </span>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        You have full Pro access. Subscribe to keep your limits after the trial ends.
      </p>
    </div>
  );
}

export default function BillingPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<BillingStatus>("/billing/status", { token })
      .then(setStatus)
      .catch(() => setError("Failed to load billing status"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCheckout(plan: "monthly" | "annual") {
    if (!token) return;
    setActionLoading(plan);
    try {
      const { url } = await api<{ url: string }>("/billing/create-checkout", {
        method: "POST",
        body: { plan },
        token,
      });
      window.location.href = url;
    } catch {
      setError("Failed to start checkout");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePortal() {
    if (!token) return;
    setActionLoading("portal");
    try {
      const { url } = await api<{ url: string }>("/billing/create-portal", {
        method: "POST",
        token,
      });
      window.location.href = url;
    } catch {
      setError("Failed to open billing portal");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBuyCredits() {
    if (!token) return;
    setActionLoading("credits");
    try {
      const { url } = await api<{ url: string }>("/billing/buy-credits", {
        method: "POST",
        token,
      });
      window.location.href = url;
    } catch {
      setError("Failed to start purchase");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--color-border)] rounded w-48" />
          <div className="h-32 bg-[var(--color-border)] rounded-xl" />
          <div className="h-24 bg-[var(--color-border)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <p className="text-red-500">{error || "Unable to load billing information"}</p>
      </div>
    );
  }

  const isBetaTester = status.effectiveTier === "beta-tester";
  const isPro = status.effectiveTier === "pro" || isBetaTester;
  const isTrialing = !isBetaTester && status.trial?.active === true;
  const isPaid = !!status.subscription;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-6">
        Billing & Plan
      </h1>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isTrialing && status.trial && <TrialBanner endsAt={status.trial.endsAt} />}

      {/* Plan Status Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isBetaTester ? "Beta Tester" : isPaid ? "Pro" : isTrialing ? "Pro (Trial)" : "Free"}
            </h2>
            {isPaid && status.subscription && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {status.subscription.plan === "annual" ? "$390/year" : "$39/month"}
              </p>
            )}
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              isPro
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
            }`}
          >
            {status.effectiveTier.toUpperCase()}
          </span>
        </div>

        {/* Upgrade CTA for free/trial users — never shown to beta testers */}
        {!isPaid && !isBetaTester && (
          <div className="space-y-2">
            <button
              onClick={() => handleCheckout("monthly")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {actionLoading === "monthly" ? "Redirecting..." : "Subscribe Monthly — $39/mo"}
            </button>
            <button
              onClick={() => handleCheckout("annual")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] font-medium text-sm hover:bg-[var(--color-primary)]/5 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "annual" ? "Redirecting..." : "Subscribe Annual — $390/yr (save 17%)"}
            </button>
          </div>
        )}

        {/* Manage subscription for paid users */}
        {isPaid && (
          <button
            onClick={handlePortal}
            disabled={actionLoading !== null}
            className="w-full py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium text-sm hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
          >
            {actionLoading === "portal" ? "Opening..." : "Manage Subscription"}
          </button>
        )}
      </div>

      {/* Usage Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-6">
        <h2 className="text-base font-semibold mb-3">Usage This Month</h2>
        <UsageBar
          used={status.usage.aiListings.used}
          limit={status.usage.aiListings.limit}
          label="AI Listings"
        />
        <UsageBar
          used={status.usage.bgRemovals.used}
          limit={status.usage.bgRemovals.limit}
          label="Background Removals"
        />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Porter Exchanges/Day</span>
          <span className="text-sm font-medium">{status.usage.porterExchanges.limit}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Marketplaces</span>
          <span className="text-sm font-medium">
            {status.usage.marketplaces.limit === null ? "All" : status.usage.marketplaces.limit}
          </span>
        </div>
      </div>

      {/* Credits Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">AI Listing Credits</h2>
          <span className="text-lg font-bold">{status.usage.aiListings.credits}</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          Credits are used when your monthly AI listing allocation is exhausted. They never expire.
        </p>
        <button
          onClick={handleBuyCredits}
          disabled={actionLoading !== null}
          className="w-full py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
        >
          {actionLoading === "credits" ? "Redirecting..." : "Buy 10 Credits — $5"}
        </button>
      </div>
    </div>
  );
}
