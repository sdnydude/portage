"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";
import { PageHeader } from "@/components/layout/page-header";

interface SettingsLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number;
}

function SettingsLink({ href, icon, title, description, badge }: SettingsLinkProps) {
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
      {badge != null && badge > 0 && (
        <span
          className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center flex-shrink-0"
          aria-label={`${badge} unread`}
          role="status"
        >
          <span className="text-[10px] font-bold text-white" aria-hidden="true">{badge > 9 ? "9+" : badge}</span>
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function MorePage() {
  const { user, logout } = useAuth();
  const { count: unreadCount } = useUnreadCount();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="px-4 py-4 content-container">
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
            href="/settings/profile"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            title="Profile"
            description="Display name, email, address"
          />

          <SettingsLink
            href="/settings/billing"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            }
            title="Billing & Plan"
            description="Subscription, usage, credits"
          />

          <SettingsLink
            href="/settings/marketplace"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            }
            title="Marketplace Accounts"
            description="eBay and Reverb connections"
          />

          <SettingsLink
            href="/messages"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            }
            title="Messages"
            description="Buyer conversations"
            badge={unreadCount}
          />

          <SettingsLink
            href="/settings/seller-profile"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
            title="Seller Profile"
            description="Return policy, shipping defaults"
          />

          <SettingsLink
            href="/settings/notifications"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            }
            title="Notifications"
            description="Sale alerts, shipping reminders"
          />

          <SettingsLink
            href="/tutorials"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
              </svg>
            }
            title="Tutorials"
            description="Learn Portage step by step"
          />

          <SettingsLink
            href="/settings/help"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            title="Help & Support"
            description="FAQ, contact, app info"
          />

          {user?.role === "admin" && (
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
          )}
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
