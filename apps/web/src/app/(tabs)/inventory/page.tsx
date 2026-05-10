"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/inventory/search-bar";
import { ViewControls } from "@/components/inventory/view-controls";
import { ItemCard } from "@/components/inventory/item-card";
import { BulkActionBar } from "@/components/inventory/bulk-action-bar";
import { useItems } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { api, ApiError } from "@/lib/api";

export default function InventoryPage() {
  const { isAuthenticated, token } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Category update modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingCategory, setPendingCategory] = useState("");

  const { items, total, isLoading, error, refetch } = useItems({ search, category });
  const { selectedIds, isSelecting, toggle, selectAll, clearSelection, toggleSelecting, selectedCount } = useBulkSelect<typeof items[number]>();

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !token) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`);
    if (!confirmed) return;

    setBulkLoading(true);
    setBulkError(null);
    try {
      await api("/items/bulk/delete", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
        token,
      });
      clearSelection();
      await refetch();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to delete items");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, clearSelection, refetch]);

  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0 || !token) return;

    setBulkLoading(true);
    setBulkError(null);
    try {
      const result = await api<{ items: unknown[]; count: number }>("/items/bulk/export", {
        method: "POST",
        body: { ids: Array.from(selectedIds) },
        token,
      });

      // Trigger browser download
      const json = JSON.stringify(result.items, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portage-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to export items");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, clearSelection]);

  const handleBulkUpdateCategory = useCallback(async () => {
    if (!pendingCategory.trim() || selectedIds.size === 0 || !token) return;

    setBulkLoading(true);
    setBulkError(null);
    setShowCategoryModal(false);
    try {
      await api("/items/bulk/update", {
        method: "POST",
        body: { ids: Array.from(selectedIds), updates: { category: pendingCategory.trim() } },
        token,
      });
      clearSelection();
      setPendingCategory("");
      await refetch();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to update category");
    } finally {
      setBulkLoading(false);
    }
  }, [pendingCategory, selectedIds, token, clearSelection, refetch]);

  if (!isAuthenticated) {
    return (
      <>
        <PageHeader title="Inventory" subtitle="Your items" />
        <div className="px-4 py-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
              Sign in to see your items
            </h2>
            <p className="text-sm text-text-secondary max-w-xs">
              Create an account or sign in to start inventorying your personal effects.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={total > 0 ? `${total} item${total !== 1 ? "s" : ""}` : undefined}
        action={
          items.length > 0 ? (
            <button
              onClick={toggleSelecting}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelecting
                  ? "bg-forest-green text-white"
                  : "bg-muted text-text-secondary hover:text-text-primary"
              }`}
            >
              {isSelecting ? "Done" : "Select"}
            </button>
          ) : undefined
        }
      />
      <div className="px-4 py-3 max-w-lg mx-auto space-y-3">
        <SearchBar value={search} onChange={setSearch} />
        <ViewControls
          view={view}
          onViewChange={setView}
          total={total}
          category={category}
          onCategoryChange={setCategory}
        />

        {bulkError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {bulkError}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-forest-green-50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-2">
              {search || category ? "No matching items" : "No items yet"}
            </h2>
            <p className="text-sm text-text-secondary max-w-xs">
              {search || category
                ? "Try adjusting your search or filters."
                : "Tap the camera button to photograph your first item. Porter will identify it automatically."}
            </p>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div
            className={
              view === "grid"
                ? "grid grid-cols-2 gap-3"
                : "flex flex-col gap-2"
            }
          >
            {items.map((item) =>
              isSelecting ? (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="relative text-left focus:outline-none"
                  aria-pressed={selectedIds.has(item.id)}
                  aria-label={`${selectedIds.has(item.id) ? "Deselect" : "Select"} ${item.title}`}
                >
                  {/* Checkbox overlay */}
                  <div
                    className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(item.id)
                        ? "bg-forest-green border-forest-green"
                        : "bg-surface/80 border-border backdrop-blur-sm"
                    }`}
                    aria-hidden="true"
                  >
                    {selectedIds.has(item.id) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {/* Ring highlight when selected */}
                  {selectedIds.has(item.id) && (
                    <div className="absolute inset-0 rounded-xl ring-2 ring-forest-green z-10 pointer-events-none" aria-hidden="true" />
                  )}
                  <ItemCard item={item} view={view} />
                </button>
              ) : (
                <ItemCard key={item.id} item={item} view={view} />
              )
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar — shown above tab bar when in select mode with items selected */}
      {isSelecting && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={items.length}
          onSelectAll={() => selectAll(items)}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
          onUpdateCategory={() => setShowCategoryModal(true)}
          onExport={handleBulkExport}
          isLoading={bulkLoading}
        />
      )}

      {/* Category update modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-semibold font-[family-name:var(--font-instrument)] text-text-primary mb-1">
              Update Category
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Set a new category for {selectedCount} selected item{selectedCount !== 1 ? "s" : ""}.
            </p>
            <input
              type="text"
              value={pendingCategory}
              onChange={(e) => setPendingCategory(e.target.value)}
              placeholder="e.g. Electronics, Clothing, Books…"
              className="w-full px-4 py-3 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-border focus:outline-none focus:border-border-focus"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && pendingCategory.trim()) handleBulkUpdateCategory();
                if (e.key === "Escape") setShowCategoryModal(false);
              }}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-medium text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateCategory}
                disabled={!pendingCategory.trim()}
                className="flex-1 py-2.5 rounded-xl bg-forest-green text-sm font-medium text-white disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
