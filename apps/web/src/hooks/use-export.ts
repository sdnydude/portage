"use client";

import { useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { useAuth } from "./use-auth";

export type ExportFormat = "ebay_csv" | "json";

interface ExportOptions {
  ids?: string[];
  category?: string;
  condition?: string;
}

export function useExport() {
  const { token } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportItems = useCallback(
    async (format: ExportFormat, options: ExportOptions = {}): Promise<void> => {
      if (!token) return;

      setIsExporting(true);
      setExportError(null);

      try {
        const params = new URLSearchParams({ format });
        if (options.ids && options.ids.length > 0) {
          params.set("ids", options.ids.join(","));
        }
        if (options.category) params.set("category", options.category);
        if (options.condition) params.set("condition", options.condition);

        const response = await fetch(`${API_BASE}/items/export?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Export failed" }));
          throw new Error((data as { error?: string }).error ?? "Export failed");
        }

        const blob = await response.blob();

        // Derive filename from Content-Disposition header or fall back to a default
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const filenameMatch = disposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch
          ? filenameMatch[1]
          : format === "ebay_csv"
            ? `portage-ebay-export-${new Date().toISOString().slice(0, 10)}.csv`
            : `portage-export-${new Date().toISOString().slice(0, 10)}.json`;

        // Trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setExportError(err instanceof Error ? err.message : "Export failed");
        throw err;
      } finally {
        setIsExporting(false);
      }
    },
    [token],
  );

  return { exportItems, isExporting, exportError };
}
