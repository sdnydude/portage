"use client";

import type { IngestItem } from "@/hooks/use-desktop-ingest";

interface IngestQueueProps {
  items: IngestItem[];
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateTitle: (id: string, name: string) => void;
}

/**
 * Desktop ingest queue (Phase R2). Presentational — drives the useDesktopIngest
 * hook's queue. Each dropped candidate item gets a card with a status chip,
 * an editable title, and Save / Discard actions once it's identified.
 */
export function IngestQueue({
  items,
  onSave,
  onRemove,
  onUpdateTitle,
}: IngestQueueProps) {
  if (items.length === 0) return null;

  return (
    <ul data-testid="ingest-queue" className="flex flex-col gap-2 p-3">
      {items.map((item) => (
        <li
          key={item.id}
          data-testid="ingest-card"
          data-status={item.status}
          className="rounded-lg border border-border p-3"
        >
          <span className="text-xs uppercase text-muted-foreground">
            {item.status}
          </span>
          {item.fields ? (
            <input
              aria-label="Item title"
              value={item.fields.name}
              onChange={(e) => onUpdateTitle(item.id, e.target.value)}
              className="mt-1 w-full rounded border border-border px-2 py-1"
            />
          ) : null}
          {item.status === "ready" ? (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onSave(item.id)}>
                Save
              </button>
              <button type="button" onClick={() => onRemove(item.id)}>
                Discard
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
