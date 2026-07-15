"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AskPorterBar } from "@/components/porter/ask-porter-bar";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";
import { pageTitle } from "@/lib/navigation";

export function TopBar() {
  const pathname = usePathname() ?? "/";
  const { user, logout } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-md">
      <h1 className="w-48 shrink-0 truncate font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">
        {pageTitle(pathname)}
      </h1>

      <div className="flex min-w-0 flex-1 justify-center">
        <AskPorterBar />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/messages"
          aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] bg-[var(--orange)]" />
          )}
        </Link>

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--teal)] font-bold text-white"
          >
            {user?.email?.charAt(0).toUpperCase() ?? "?"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-surface py-2 shadow-lg" role="menu">
              <p className="truncate px-4 py-2 text-xs text-text-secondary">{user?.email}</p>
              <Link href="/settings/profile" role="menuitem" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-muted">
                Profile
              </Link>
              <Link href="/more" role="menuitem" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-muted">
                Settings
              </Link>
              <button role="menuitem" onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-accent-error hover:bg-muted">
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
