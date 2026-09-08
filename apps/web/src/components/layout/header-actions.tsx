"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";
import { ThemeToggle } from "@/components/theme-toggle";

/** The always-present header cluster: theme toggle + user menu (avatar → /more). */
export function HeaderActions() {
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-primary" />
      {user && (
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
      )}
    </div>
  );
}
