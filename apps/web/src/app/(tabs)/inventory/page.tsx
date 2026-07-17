"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AskPorterBar } from "@/components/porter/ask-porter-bar";
import { SearchBar } from "@/components/inventory/search-bar";
import { ViewControls } from "@/components/inventory/view-controls";
import { ItemCard } from "@/components/inventory/item-card";
import { BulkActionBar } from "@/components/inventory/bulk-action-bar";
import { ExportActionSheet } from "@/components/inventory/export-action-sheet";
import { useItems } from "@/hooks/use-items";
import type { Item } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { api, ApiError } from "@/lib/api";
import { useExport } from "@/hooks/use-export";
import { ItemDetail } from "@/components/inventory/item-detail";
import { MasterDetail } from "@/components/workbench/master-detail";
import { useListNav } from "@/hooks/use-list-nav";

function ExportButton() {
  const { exportItems, isExporting } = useExport();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleExport(format: "ebay_csv" | "json") {
    setOpen(false);
    try {
      await exportItems(format);
      setToast(format === "ebay_csv" ? "eBay CSV downloaded" : "JSON exported");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Export failed — please try again");
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={isExporting}
          aria-label="Export inventory"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-text-secondary hover:text-text-primary hover:bg-muted/80 transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          Export
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
            <button
              onClick={() => handleExport("ebay_csv")}
              className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-muted transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Export to eBay CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-muted transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Export as JSON
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-text-primary text-background text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toast}
        </div>
      )}
    </>
  );
}

function ItemsGrid({
  items,
  view,
  isSelecting,
  selectedIds,
  onToggle,
  onOpen,
  selectedId,
  pane,
}: {
  items: Item[];
  view: "grid" | "list";
  isSelecting: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
  selectedId?: string | null;
  pane?: boolean;
}) {
  return (
    <div
      className={
        view === "grid"
          ? // The 380px workbench pane must not inherit viewport-scoped column
            // counts — xl:grid-cols-4 in the pane collapses card titles.
            pane
            ? "grid grid-cols-2 gap-3"
            : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
          : "flex flex-col gap-2"
      }
    >
      {items.map((item) =>
        isSelecting ? (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
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
            {/* Non-interactive card: a link-mode ItemCard here nests a Link
                inside the toggle button and navigates after the toggle fires
                (registry 334daef2). */}
            <ItemCard item={item} view={view} interactive={false} />
          </button>
        ) : (
          <ItemCard
            key={item.id}
            item={item}
            view={view}
            onOpen={onOpen ? () => onOpen(item.id) : undefined}
            selected={item.id === selectedId}
          />
        ),
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { isAuthenticated, token } = useAuth();
  const { exportItems } = useExport();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Category update modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingCategory, setPendingCategory] = useState("");

  // Export action sheet state
  const [showExportSheet, setShowExportSheet] = useState(false);

  const { items, total, isLoading, error, refetch } = useItems({ search, category });
  const { selectedIds, isSelecting, toggle, selectAll, clearSelection, toggleSelecting, selectedCount } = useBulkSelect<typeof items[number]>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("item");
    if (id) setSelectedId(id);
  }, []);

  const selectItem = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `/inventory?item=${id}`);
  }, []);

  const clearDetailSelection = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", "/inventory");
  }, []);

  const { onKeyDown: onListKeyDown } = useListNav({
    ids: items.map((i) => i.id),
    selectedId,
    onSelect: selectItem,
  });

  // Keep the selected card visible when arrow-keying.
  useEffect(() => {
    if (!selectedId) return;
    document
      .querySelector(`[data-item-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

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

  const handleBulkExport = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowExportSheet(true);
  }, [selectedIds]);

  const handleEbayCsvExport = useCallback(async () => {
    if (!token) return;
    setBulkLoading(true);
    setBulkError(null);
    try {
      await exportItems("ebay_csv", { ids: Array.from(selectedIds) });
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to export items");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, token, exportItems, clearSelection]);

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
        <PageHeader title="Inventory" subtitle="Your items" showAvatar />
        <div className="px-4 py-6 content-container">
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
      <div className="lg:hidden">
        <PageHeader
          title="Inventory"
          subtitle={total > 0 ? `${total} item${total !== 1 ? "s" : ""}` : undefined}
          showAvatar
          action={
            items.length > 0 ? (
              <div className="flex items-center gap-2">
                <ExportButton />
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
              </div>
            ) : undefined
          }
        />
        <div className="lg:hidden px-4 pt-3 content-container w-full">
          <AskPorterBar />
        </div>
        <div className="px-4 py-3 content-container space-y-3">
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
            <ItemsGrid
              items={items}
              view={view}
              isSelecting={isSelecting}
              selectedIds={selectedIds}
              onToggle={toggle}
            />
          )}
        </div>
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

      {/* Export action sheet */}
      <ExportActionSheet
        show={showExportSheet}
        selectedIds={Array.from(selectedIds)}
        onClose={() => setShowExportSheet(false)}
        onEbayCsv={handleEbayCsvExport}
      />

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

      <MasterDetail
        listLabel="Inventory list"
        list={
          <div
            className="space-y-3 p-4 outline-none"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            aria-label="Inventory items — use arrow keys to browse"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-secondary">
                {total} item{total !== 1 ? "s" : ""}
              </span>
              {items.length > 0 && (
                <div className="flex items-center gap-2">
                  <ExportButton />
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
                </div>
              )}
            </div>
            <SearchBar value={search} onChange={setSearch} />
            <ViewControls
              view={view}
              onViewChange={setView}
              total={total}
              category={category}
              onCategoryChange={setCategory}
            />

            {isLoading && (
              <div data-testid="list-pane-loading" className="flex items-center justify-center py-16">
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
              <ItemsGrid
                items={items}
                view={view}
                isSelecting={isSelecting}
                selectedIds={selectedIds}
                onToggle={toggle}
                onOpen={selectItem}
                selectedId={selectedId}
                pane
              />
            )}
          </div>
        }
        detail={
          selectedId ? (
            <ItemDetail
              key={selectedId}
              itemId={selectedId}
              variant="pane"
              onDeleted={() => {
                clearDetailSelection();
                refetch();
              }}
              onBack={clearDetailSelection}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-text-secondary">Select an item to view and edit it</p>
            </div>
          )
        }
      />
    </>
  );
}
