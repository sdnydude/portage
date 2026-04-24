"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useItem } from "@/hooks/use-item";
import { useAuth } from "@/hooks/use-auth";

const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const categories = [
  "electronics", "clothing", "furniture", "collectibles", "sports",
  "home", "books", "toys", "tools", "jewelry", "art", "music", "other",
];

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { item, isLoading, error, updateItem } = useItem(params.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("good");
  const [conditionNotes, setConditionNotes] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description);
      setCategory(item.category);
      setCondition(item.condition);
      setConditionNotes(item.conditionNotes);
      setBrand(item.brand);
      setModel(item.model);
    }
  }, [item]);

  if (!isAuthenticated) {
    router.replace("/inventory");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center max-w-lg mx-auto">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="ml-3 text-lg font-semibold text-text-primary">Error</span>
          </div>
        </header>
        <div className="px-4 py-16 text-center">
          <p className="text-text-secondary">{error ?? "Item not found"}</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateItem({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        conditionNotes: conditionNotes.trim(),
        brand: brand.trim(),
        model: model.trim(),
      });
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      setIsSaving(false);
    }
  };

  const hasChanges =
    title !== item.title ||
    description !== item.description ||
    category !== item.category ||
    condition !== item.condition ||
    conditionNotes !== item.conditionNotes ||
    brand !== item.brand ||
    model !== item.model;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="ml-3 text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
              Edit Item
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !title.trim()}
            className="px-4 py-1.5 rounded-lg bg-forest-green text-white text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {saveError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {saveError}
          </div>
        )}

        <FieldGroup label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
          />
        </FieldGroup>

        <FieldGroup label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none resize-none"
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Condition">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            >
              {conditions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FieldGroup>
        </div>

        <FieldGroup label="Condition Notes">
          <textarea
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Any scratches, wear, defects..."
            className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none resize-none"
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Brand">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={255}
              placeholder="e.g. Sony, Nike"
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
          </FieldGroup>

          <FieldGroup label="Model">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              maxLength={255}
              placeholder="e.g. WH-1000XM5"
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
          </FieldGroup>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
