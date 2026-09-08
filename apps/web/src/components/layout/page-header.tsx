"use client";

import { HeaderActions } from "./header-actions";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showAvatar?: boolean;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
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
        {/* action and the header cluster coexist — the cluster must never be
            suppressed by a page action (it replaces the More tab; Orders' Sync etc. render beside it) */}
        <div className="flex items-center gap-2">
          {action}
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
