"use client";

interface ToolBlockProps {
  toolName: string;
  toolId: string;
  status: "running" | "complete" | "error";
  duration?: number;
  errorMessage?: string;
}

export function ToolBlock({ toolName, status, duration, errorMessage }: ToolBlockProps) {
  const label = toolName.replace(/_/g, " ");

  return (
    <div className="flex items-center gap-2 rounded-lg border-l-2 border-[var(--forest-green)] bg-[color-mix(in_srgb,var(--forest-green)_8%,transparent)] px-3 py-2 text-sm">
      {status === "running" && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--forest-green)] border-t-transparent" />
      )}
      {status === "complete" && (
        <svg className="h-3.5 w-3.5 text-[var(--forest-green)]" fill="none" viewBox="0 0 16 16">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l3.5 3.5L13 4" />
        </svg>
      )}
      {status === "error" && (
        <span className="text-red-500">✕</span>
      )}
      <span className="capitalize text-[var(--forest-green)]">{label}</span>
      {status === "running" && <span className="text-[var(--muted)]">Working…</span>}
      {status === "complete" && duration !== undefined && (
        <span className="font-jetbrains ml-auto text-xs text-[var(--muted)]">{duration.toFixed(1)}s</span>
      )}
      {status === "error" && errorMessage && (
        <span className="ml-1 text-red-500">{errorMessage}</span>
      )}
    </div>
  );
}
