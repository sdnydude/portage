import type { Item } from "@/hooks/use-items";

/** The subset of an Item editable from the detail panel's inline edit mode. */
export interface ItemEditFields {
  title: string;
  description: string;
  category: string;
  condition: string;
  conditionNotes: string;
  brand: string;
  model: string;
  quantity: number;
  // Seller-set sale price (dollars). null = unset.
  price: number | null;
  // eBay Calculated shipping: weight in decimal POUNDS (the UI works in lb+oz),
  // dimensions in inches. weightEstimated marks AI-populated vs seller-confirmed.
  weight: number | null;
  dimLength: number | null;
  dimWidth: number | null;
  dimHeight: number | null;
  ebayPackageType: string | null;
  weightEstimated: boolean;
}

/** PATCH payload for the items route: weight normalized to ounces, free-text trimmed. */
export interface ItemUpdatePayload {
  title: string;
  description: string;
  category: string;
  condition: string;
  conditionNotes: string;
  brand: string;
  model: string;
  quantity: number;
  // route schema is min(0.01).optional() — omit (undefined) rather than send null/0.
  price?: number;
  // route schema is positive().optional() — omit (undefined) rather than send null/0.
  weightOz?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  ebayPackageType?: string;
  weightEstimated: boolean;
}

/** Seed edit-mode form state from the loaded item. */
export function itemToEditFields(item: Item): ItemEditFields {
  return {
    title: item.title,
    description: item.description,
    category: item.category,
    condition: item.condition,
    conditionNotes: item.conditionNotes,
    brand: item.brand,
    model: item.model,
    quantity: item.quantity ?? 1,
    price: item.price ?? null,
    // weight column is ounces; the UI works in decimal pounds.
    weight: item.weightOz != null ? item.weightOz / 16 : null,
    dimLength: item.lengthIn ?? null,
    dimWidth: item.widthIn ?? null,
    dimHeight: item.heightIn ?? null,
    ebayPackageType: item.ebayPackageType ?? null,
    weightEstimated: item.weightEstimated ?? false,
  };
}

/** Build the PATCH payload: trim free-text fields, normalize weight to ounces. */
export function buildItemUpdate(fields: ItemEditFields): ItemUpdatePayload {
  const rawOz = fields.weight != null ? Math.round(fields.weight * 16) : 0;
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    category: fields.category,
    condition: fields.condition,
    conditionNotes: fields.conditionNotes.trim(),
    brand: fields.brand.trim(),
    model: fields.model.trim(),
    quantity: fields.quantity,
    price: fields.price != null && fields.price > 0 ? fields.price : undefined,
    weightOz: rawOz > 0 ? rawOz : undefined,
    lengthIn: fields.dimLength ?? undefined,
    widthIn: fields.dimWidth ?? undefined,
    heightIn: fields.dimHeight ?? undefined,
    ebayPackageType: fields.ebayPackageType ?? undefined,
    weightEstimated: fields.weightEstimated,
  };
}

/** True when any editable field differs from the persisted item. */
export function hasItemChanges(fields: ItemEditFields, item: Item): boolean {
  return (
    fields.title !== item.title ||
    fields.description !== item.description ||
    fields.category !== item.category ||
    fields.condition !== item.condition ||
    fields.conditionNotes !== item.conditionNotes ||
    fields.brand !== item.brand ||
    fields.model !== item.model ||
    fields.quantity !== (item.quantity ?? 1) ||
    fields.price !== (item.price ?? null) ||
    fields.weight !== (item.weightOz != null ? item.weightOz / 16 : null) ||
    fields.dimLength !== (item.lengthIn ?? null) ||
    fields.dimWidth !== (item.widthIn ?? null) ||
    fields.dimHeight !== (item.heightIn ?? null) ||
    fields.ebayPackageType !== (item.ebayPackageType ?? null)
  );
}

/** Save is allowed only with a non-empty title and at least one real change. */
export function canSaveItemEdit(fields: ItemEditFields, item: Item): boolean {
  return fields.title.trim().length > 0 && hasItemChanges(fields, item);
}
