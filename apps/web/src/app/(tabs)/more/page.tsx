"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";

interface SettingsLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function SettingsLink({ href, icon, title, description }: SettingsLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-surface transition-colors hover:bg-muted"
      style={{ boxShadow: "var(--shadow-subtle)" }}
    >
      <div className="w-10 h-10 rounded-xl bg-forest-green-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function MorePage() {
  const { user, logout } = useAuth();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* User info */}
        {user && (
          <div className="mb-6 p-4 rounded-2xl border border-border bg-surface" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-forest-green flex items-center justify-center">
                <span className="text-white font-bold text-lg font-[family-name:var(--font-instrument)]">
                  {user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{user.email}</p>
                <p className="text-xs text-text-secondary capitalize">{user.subscriptionTier} plan</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings links */}
        <div className="space-y-2">
          <SettingsLink
            href="/settings/shipping"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            }
            title="Shipping"
            description="Ship-from address, presets, provider"
          />

          <SettingsLink
            href="/admin"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            }
            title="Admin Panel"
            description="System settings and user management"
          />
        </div>

        {/* Logout */}
        <div className="mt-8">
          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl border border-accent-error text-accent-error text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Log Out
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-[11px] text-text-placeholder mt-6">
          Portage v1.0.0
        </p>
      </div>
    </>
  );
}
