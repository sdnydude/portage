"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showAvatar?: boolean;
}

export function PageHeader({ title, subtitle, action, showAvatar }: PageHeaderProps) {
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  const avatar =
    showAvatar && user ? (
      <Link
        href="/more"
        aria-label={unreadCount > 0 ? `Settings, ${unreadCount} unread messages` : "Settings"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--teal)] font-bold text-white"
      >
        {user.email.charAt(0).toUpperCase()}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--background)] bg-[var(--orange)]" />
        )}
      </Link>
    ) : null;

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
      <div className="flex items-center justify-between content-container">
        <div>
          <h1 className="text-xl font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        {/* action and avatar coexist — avatar must never be suppressed by a
            page action (it replaces the More tab; Orders' Sync etc. render beside it) */}
        <div className="flex items-center gap-2">
          {action}
          {avatar}
        </div>
      </div>
    </header>
  );
}
