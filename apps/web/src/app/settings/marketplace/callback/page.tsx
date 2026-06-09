"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type Status = "processing" | "cancelled" | "expired" | "error";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string>("");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    // User declined consent (eBay sends ?error / omits ?code): do not call the API.
    if (error || !code || !state) {
      setStatus("cancelled");
      setMessage(
        errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
          : "You cancelled the eBay connection. No changes were made.",
      );
      return;
    }

    // Session expired during the round-trip to eBay.
    if (!token) {
      setStatus("expired");
      setMessage("Your session expired. Please log in again, then reconnect eBay.");
      return;
    }

    // Dedupe: React StrictMode double-invokes effects in dev, and the OAuth
    // state is single-use server-side. sessionStorage survives the remount that
    // useRef does not, so the token exchange fires exactly once.
    const dedupeKey = `ebay_oauth_exchange_${state}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");

    api("/marketplace/ebay/callback", { method: "POST", token, body: { code, state } })
      .then(() => {
        // Land on the consolidated eBay panel (connect ✓ → ship-from → Set Up),
        // not back on the bare marketplace list.
        router.replace("/settings/seller-profile");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err instanceof ApiError
            ? err.message
            : "Could not complete the eBay connection. Please try again.",
        );
      });
  }, [code, state, error, errorDescription, token, router]);

  if (status === "processing") {
    return (
      <Centered>
        <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-text-secondary">Connecting your eBay account…</p>
      </Centered>
    );
  }

  const isError = status === "error";
  return (
    <Centered>
      <div
        className={`w-full max-w-sm rounded-2xl border p-5 text-sm ${
          isError
            ? "border-accent-error bg-red-50 dark:bg-red-950/30 text-accent-error"
            : "border-border bg-surface text-text-primary"
        }`}
        style={{ boxShadow: "var(--shadow-subtle)" }}
      >
        <h1 className="mb-2 text-base font-semibold font-[family-name:var(--font-instrument)]">
          {status === "cancelled" && "Connection cancelled"}
          {status === "expired" && "Session expired"}
          {status === "error" && "Connection failed"}
        </h1>
        <p className={isError ? "" : "text-text-secondary"}>{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => router.replace("/settings/marketplace")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-green text-white transition-opacity hover:opacity-90"
          >
            Back to marketplaces
          </button>
          {status === "expired" && (
            <button
              onClick={() => router.replace("/login")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-primary transition-colors hover:bg-background"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      {children}
    </div>
  );
}

export default function EbayCallbackPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
        </Centered>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
