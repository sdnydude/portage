"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface ExportActionSheetProps {
  show: boolean;
  selectedIds: string[];
  onClose: () => void;
  onEbayCsv: () => Promise<void>;
}

interface PrepareResult {
  token: string;
  itemCount: number;
  photoCount: number;
  skippedCount: number;
}

type State = "idle" | "preparing" | "ready" | "error";

export function ExportActionSheet({
  show,
  selectedIds,
  onClose,
  onEbayCsv,
}: ExportActionSheetProps) {
  const { token } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePhotoExport() {
    if (!token) return;
    setState("preparing");
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/items/photos/export/prepare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Failed to prepare export";
        if (res.status === 422) {
          setErrorMsg("None of the selected items have photos.");
        } else {
          setErrorMsg(msg);
        }
        setState("error");
        return;
      }

      const data: PrepareResult = await res.json();
      setPrepared(data);
      setState("ready");

      // Trigger download immediately via hidden anchor
      const a = document.createElement("a");
      a.href = `${API_BASE}/items/photos/export?token=${data.token}`;
      a.download = `portage-photos-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setErrorMsg("Network error — please try again.");
      setState("error");
    }
  }

  async function handleEbayCsv() {
    setState("preparing");
    try {
      await onEbayCsv();
      onClose();
    } catch {
      setErrorMsg("eBay CSV export failed — please try again.");
      setState("error");
    }
  }

  function handleClose() {
    setState("idle");
    setPrepared(null);
    setErrorMsg(null);
    onClose();
  }

  if (!show) return null;

  const count = selectedIds.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export options"
        className="fixed bottom-0 left-0 right-0 z-[61] bg-background rounded-t-2xl shadow-xl animate-slide-up"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-4 pb-4 pt-2">
          <h2 className="text-base font-semibold text-text-primary mb-1">
            Export {count} item{count !== 1 ? "s" : ""}
          </h2>

          {state === "ready" && prepared && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">
              Downloading {prepared.photoCount} photo{prepared.photoCount !== 1 ? "s" : ""}
              {prepared.skippedCount > 0 && ` (${prepared.skippedCount} item${prepared.skippedCount !== 1 ? "s" : ""} skipped — no photos)`}
            </p>
          )}
          {state === "error" && errorMsg && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{errorMsg}</p>
          )}

          <div className="flex flex-col gap-2 mt-3">
            {/* Photo ZIP export */}
            <button
              onClick={handlePhotoExport}
              disabled={state === "preparing"}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-forest-green-50 dark:bg-green-950/30 text-forest-green dark:text-green-400 font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {state === "preparing" ? (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
              <span className="text-left">
                <span className="block">Download Photos (ZIP)</span>
                <span className="block text-xs font-normal opacity-70">All photos from selected items</span>
              </span>
            </button>

            {/* eBay CSV export */}
            <button
              onClick={handleEbayCsv}
              disabled={state === "preparing"}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="text-left">
                <span className="block">Export to eBay CSV</span>
                <span className="block text-xs font-normal opacity-70">Seller Hub bulk listing format</span>
              </span>
            </button>

            {/* Cancel */}
            <button
              onClick={handleClose}
              className="w-full px-4 py-3 rounded-xl bg-muted text-text-secondary font-medium text-sm active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
