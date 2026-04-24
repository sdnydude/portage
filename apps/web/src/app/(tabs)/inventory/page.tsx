"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/inventory/search-bar";
import { ViewControls } from "@/components/inventory/view-controls";
import { ItemCard } from "@/components/inventory/item-card";
import { useItems } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";

export default function InventoryPage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { items, total, isLoading, error } = useItems({ search, category });

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
            {items.map((item) => (
              <ItemCard key={item.id} item={item} view={view} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
