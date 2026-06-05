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
  };
}

/** Build the PATCH payload: trim free-text fields, pass through enums/quantity. */
export function buildItemUpdate(fields: ItemEditFields): ItemEditFields {
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    category: fields.category,
    condition: fields.condition,
    conditionNotes: fields.conditionNotes.trim(),
    brand: fields.brand.trim(),
    model: fields.model.trim(),
    quantity: fields.quantity,
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
    fields.quantity !== (item.quantity ?? 1)
  );
}

/** Save is allowed only with a non-empty title and at least one real change. */
export function canSaveItemEdit(fields: ItemEditFields, item: Item): boolean {
  return fields.title.trim().length > 0 && hasItemChanges(fields, item);
}
