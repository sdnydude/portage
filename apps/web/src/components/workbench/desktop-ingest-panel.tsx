"use client";

import { useState } from "react";
import { DropZone } from "./drop-zone";
import { IngestQueue } from "./ingest-queue";
import { useDesktopIngest } from "@/hooks/use-desktop-ingest";
import type { IngestGroupingMode } from "@/lib/desktop-ingest";

/**
 * Desktop drag-drop ingest (Phase R2). Wraps the workbench list region: drop
 * image files anywhere over it to batch-add items. The grouping toggle lets the
 * user pick, per drop, whether each file becomes its own item ("separate") or
 * the whole drop is one multi-photo item ("single").
 */
export function DesktopIngestPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { queue, addFiles, save, updateFields, remove } = useDesktopIngest();
  const [mode, setMode] = useState<IngestGroupingMode>("separate");

  return (
    <DropZone onFiles={(files) => addFiles(files, mode)}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <span className="uppercase text-muted-foreground">Drop mode</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="ingest-mode"
            checked={mode === "separate"}
            onChange={() => setMode("separate")}
          />
          Separate items
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="ingest-mode"
            checked={mode === "single"}
            onChange={() => setMode("single")}
          />
          One item, many photos
        </label>
      </div>
      <IngestQueue
        items={queue}
        onSave={save}
        onRemove={remove}
        onUpdateTitle={(id, name) => updateFields(id, { name })}
      />
      {children}
    </DropZone>
  );
}
