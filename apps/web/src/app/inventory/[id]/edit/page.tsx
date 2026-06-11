"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useItem } from "@/hooks/use-item";
import { useAuth } from "@/hooks/use-auth";
import { WeightDimsInputs, type WeightDimsValue } from "@/components/listing/weight-dims-inputs";
import { PriceField } from "@/components/listing/price-field";
import { useScanAspects } from "@/hooks/use-scan-aspects";
import { getAvailablePortageConditions } from "@/lib/ebay-condition-map";

const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
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
  const [quantity, setQuantity] = useState(1);
  const [weightDims, setWeightDims] = useState<WeightDimsValue>({
    weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null,
  });
  const [weightEstimated, setWeightEstimated] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  // Auto-resolution from the title is display/constraint-only; the resolved
  // eBay name is persisted ONLY after the seller explicitly invokes Find
  // (user input over AI — stored category never silently overwritten).
  const [categoryUserResolved, setCategoryUserResolved] = useState(false);
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
      setQuantity(item.quantity ?? 1);
      setWeightDims({
        // weight column is ounces; the input works in decimal pounds.
        weight: item.weightOz != null ? item.weightOz / 16 : null,
        dimLength: item.lengthIn ?? null,
        dimWidth: item.widthIn ?? null,
        dimHeight: item.heightIn ?? null,
        ebayPackageType: item.ebayPackageType ?? null,
      });
      setWeightEstimated(item.weightEstimated ?? false);
      setPrice(item.price ?? null);
    }
  }, [item]);

  // Manual edits clear the AI-estimated flag (these are now seller-confirmed).
  const handleWeightDimsChange = (patch: Partial<WeightDimsValue>) => {
    setWeightDims((prev) => ({ ...prev, ...patch }));
    setWeightEstimated(false);
  };

  // eBay taxonomy is THE category (the static internal list is deprecated).
  // Auto-resolves from the title; the search box overrides with any leaf.
  const {
    resolvedCategoryName,
    resolveCategory,
    isCategoryResolving,
    conditionIds,
  } = useScanAspects(title, `${title} ${description}`);
  const availableConditions = getAvailablePortageConditions(conditionIds);
  const conditionOptions = availableConditions.length > 0
    ? conditions.filter((c) =>
        (availableConditions as readonly string[]).includes(c.value) || c.value === condition)
    : conditions;

  useEffect(() => {
    if (!isAuthenticated) router.replace("/inventory");
  }, [isAuthenticated, router]);

  if (!isAuthenticated || isLoading) {
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
      // weight column is ounces; the route requires a positive weightOz, so a
      // sub-half-ounce or empty value is sent as undefined (left unchanged).
      const rawOz = weightDims.weight != null ? Math.round(weightDims.weight * 16) : 0;
      await updateItem({
        title: title.trim(),
        description: description.trim(),
        // eBay name persists only when the seller explicitly resolved it
        category: categoryUserResolved && resolvedCategoryName ? resolvedCategoryName : category,
        condition,
        conditionNotes: conditionNotes.trim(),
        brand: brand.trim(),
        model: model.trim(),
        quantity,
        ...(price && price > 0 ? { price } : {}),
        weightOz: rawOz > 0 ? rawOz : undefined,
        lengthIn: weightDims.dimLength ?? undefined,
        widthIn: weightDims.dimWidth ?? undefined,
        heightIn: weightDims.dimHeight ?? undefined,
        ebayPackageType: weightDims.ebayPackageType ?? undefined,
        weightEstimated,
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
    (price !== null && price !== (item.price ?? null)) ||
    (categoryUserResolved && resolvedCategoryName !== null && resolvedCategoryName !== item.category) ||
    category !== item.category ||
    condition !== item.condition ||
    conditionNotes !== item.conditionNotes ||
    brand !== item.brand ||
    model !== item.model ||
    quantity !== (item.quantity ?? 1) ||
    weightDims.weight !== (item.weightOz != null ? item.weightOz / 16 : null) ||
    weightDims.dimLength !== (item.lengthIn ?? null) ||
    weightDims.dimWidth !== (item.widthIn ?? null) ||
    weightDims.dimHeight !== (item.heightIn ?? null) ||
    weightDims.ebayPackageType !== (item.ebayPackageType ?? null);

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
          <FieldGroup label="Condition">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            >
              {conditionOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Price">
            <PriceField value={price} onChange={setPrice} />
          </FieldGroup>
        </div>

        <FieldGroup label="Category">
          <div className="px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary">
            {isCategoryResolving
              ? "Resolving eBay category…"
              : categoryUserResolved && resolvedCategoryName !== null
                ? resolvedCategoryName
                : category || "Not set — search below"}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search eBay categories…"
              aria-label="Search eBay category"
              className="flex-1 px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!categorySearch.trim()) return;
                setCategoryUserResolved(true);
                void resolveCategory(categorySearch.trim());
              }}
              disabled={isCategoryResolving || categorySearch.trim() === ""}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-text-primary disabled:opacity-50"
            >
              Find category
            </button>
          </div>
        </FieldGroup>

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

        <FieldGroup label="Quantity">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setQuantity(Number.isNaN(n) || n < 1 ? 1 : n);
            }}
            className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
          />
        </FieldGroup>

        {/* eBay Calculated shipping (weight + dimensions). Editing flips the
            AI-estimated flag to seller-confirmed. */}
        <WeightDimsInputs
          value={weightDims}
          onChange={handleWeightDimsChange}
          estimated={weightEstimated}
        />
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
