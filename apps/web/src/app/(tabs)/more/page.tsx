"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

export default function MorePage() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <>
      <PageHeader title="More" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {isAuthenticated && user ? (
          <div className="p-4 bg-surface rounded-xl border border-border">
            <div className="text-sm font-medium text-text-primary">{user.email}</div>
            <div className="text-xs text-text-secondary mt-0.5 capitalize">
              {user.subscriptionTier} plan
            </div>
          </div>
        ) : (
          <Link href="/login" className="block p-4 bg-forest-green rounded-xl text-center">
            <div className="text-sm font-semibold text-white">Sign in to Portage</div>
            <div className="text-xs text-white/70 mt-0.5">Access all features</div>
          </Link>
        )}

        <div className="space-y-2">
          <MoreMenuItem label="Marketplaces" description="eBay & Etsy connections" href="/settings/marketplaces" />
          <MoreMenuItem label="Subscription" description={user?.subscriptionTier === "pro" ? "Pro plan" : "Free plan"} href="/settings/subscription" />
          <MoreMenuItem label="Notifications" description="Push & in-app alerts" href="/settings/notifications" />
          <MoreMenuItem label="Help & Feedback" description="Get support" href="/settings/help" />
        </div>

        {isAuthenticated && (
          <button
            onClick={logout}
            className="w-full p-4 bg-surface rounded-xl border border-border text-sm text-red-500 font-medium text-center"
          >
            Sign Out
          </button>
        )}

        <div className="text-center text-xs text-text-placeholder pt-4">
          Portage v0.1.0
        </div>
      </div>
    </>
  );
}

function MoreMenuItem({ label, description, href }: { label: string; description: string; href: string }) {
  return (
    <Link href={href} className="w-full flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-border-focus transition-colors text-left">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-secondary mt-0.5">{description}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-secondary">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
