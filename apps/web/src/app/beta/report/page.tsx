"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, apiUpload, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const AREAS = [
  "scan",
  "inventory",
  "listings",
  "orders",
  "messages",
  "porter",
  "photos",
  "settings",
  "billing",
  "other",
] as const;

const SEVERITIES = [
  { value: "low", label: "Low — cosmetic / nitpick" },
  { value: "medium", label: "Medium — something misbehaves" },
  { value: "high", label: "High — feature broken" },
  { value: "critical", label: "Critical — data loss / can't use the app" },
] as const;

function ReportForm() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(searchParams.get("from") ?? "/");
  const [area, setArea] = useState<string>("other");
  const [severity, setSeverity] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (user && user.subscriptionTier !== "beta-tester" && user.role !== "admin") {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <p className="text-[var(--color-text-secondary)]">Beta reporting is only available to beta testers.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !description.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      let screenshotUrl: string | undefined;
      if (screenshot) {
        const form = new FormData();
        form.append("image", screenshot);
        const data = await apiUpload<{ image?: { url?: string } }>("/images", form, { token: token ?? undefined });
        screenshotUrl = data.image?.url;
      }

      await api("/beta/report", {
        method: "POST",
        token,
        body: {
          page,
          area,
          severity,
          description: description.trim(),
          ...(screenshotUrl ? { screenshotUrl } : {}),
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the report — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-instrument)] mb-2">Report received</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Thank you — your report went straight to the DHG team.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              setSubmitted(false);
              setDescription("");
              setScreenshot(null);
            }}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium"
          >
            Report another
          </button>
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium"
          >
            Back to the app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-24">
      {/* This page renders outside the tab layout (no TabBar) and PWAs have
          no browser chrome — without this header it is a navigation trap. */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
          className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Cancel
        </button>
      </div>
      <h1 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-1">
        Beta Tester Report
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Found a bug or something confusing? Tell us — every report lands directly with the DHG team.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-page">Where were you?</label>
          <input
            id="report-page"
            type="text"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-area">Feature area</label>
          <select
            id="report-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-severity">Severity</label>
          <select
            id="report-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-description">What happened?</label>
          <textarea
            id="report-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            placeholder="What did you do, what did you expect, and what happened instead?"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-screenshot">Screenshot (optional)</label>
          <input
            id="report-screenshot"
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? "Sending..." : "Send report"}
        </button>
      </form>
    </div>
  );
}

export default function BetaReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
