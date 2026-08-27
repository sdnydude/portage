"use client";

import type { ActionPill } from "@portage/shared";

interface ActionPillsProps {
  pills: ActionPill[];
  onSelect: (message: string) => void;
}

export function ActionPills({ pills, onSelect }: ActionPillsProps) {
  if (pills.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-1 animate-[spring-in_0.3s_ease]">
      {pills.map((pill) => (
        <button
          key={pill.message}
          onClick={() => onSelect(pill.message)}
          className="shrink-0 rounded-full border border-[var(--forest-green)] px-3 py-1 text-sm text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_10%,transparent)] transition-colors"
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
