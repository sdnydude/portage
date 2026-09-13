import type { RecognitionCandidate, ScanProvenance } from "@portage/shared";

export interface RescanRow {
  key: string;
  label: string;
  current: string;
  next: string;
  /** Pre-checked only when the seller has nothing in the field yet. */
  selected: boolean;
}

// No `category`: item.category holds the resolved eBay leaf name ("Electric
// Guitars") while candidate.category is the vision model's coarse bucket
// ("music") — never comparable, and writing the bucket over the leaf name would
// desync the item from its live eBay category. The scan's coarse category is
// stamped into marketplaceData.scan by buildRescanPatch instead.
export interface RescanItemFields {
  title: string;
  description: string;
  condition: string;
  conditionNotes: string;
  brand: string;
  model: string;
  features: string[];
  aspects: Record<string, string[]>;
}

type ScalarKey = Exclude<keyof RescanItemFields, "features" | "aspects">;

const SCALAR_FIELDS: { key: ScalarKey; label: string; pick: (c: RecognitionCandidate) => string }[] = [
  { key: "title", label: "Title", pick: (c) => c.name },
  { key: "description", label: "Description", pick: (c) => c.description },
  { key: "condition", label: "Condition", pick: (c) => c.condition },
  { key: "conditionNotes", label: "Condition notes", pick: (c) => c.conditionNotes },
  { key: "brand", label: "Brand", pick: (c) => c.brand ?? "" },
  { key: "model", label: "Model", pick: (c) => c.model ?? "" },
];

/** Rows where the rescan disagrees with the item; identical values are omitted. */
export function diffRescan(item: RescanItemFields, candidate: RecognitionCandidate): RescanRow[] {
  const rows: RescanRow[] = [];
  for (const f of SCALAR_FIELDS) {
    const current = item[f.key] ?? "";
    const next = f.pick(candidate);
    if (next === current) continue;
    rows.push({ key: f.key, label: f.label, current, next, selected: current === "" });
  }
  const currentFeatures = item.features.join(", ");
  const nextFeatures = candidate.features.join(", ");
  if (nextFeatures !== currentFeatures && nextFeatures !== "") {
    rows.push({ key: "features", label: "Features", current: currentFeatures, next: nextFeatures, selected: currentFeatures === "" });
  }
  for (const [name, values] of Object.entries(candidate.aspects ?? {})) {
    const current = (item.aspects[name] ?? []).join(", ");
    const next = values.join(", ");
    if (next === current || next === "") continue;
    rows.push({ key: `aspect:${name}`, label: name, current, next, selected: current === "" });
  }
  return rows;
}

export interface RescanPatch {
  title?: string;
  description?: string;
  condition?: string;
  conditionNotes?: string;
  brand?: string;
  model?: string;
  features?: string[];
  aspects?: Record<string, string[]>;
  marketplaceData: { scan: { visionCategory: string; provenance?: ScanProvenance } };
}

/** PATCH body for the selected row keys. Provenance always rides along so the
 *  DB records which model produced the applied values. */
export function buildRescanPatch(
  keys: string[],
  candidate: RecognitionCandidate,
  provenance?: ScanProvenance,
): RescanPatch {
  const patch: RescanPatch = {
    marketplaceData: { scan: { visionCategory: candidate.category, ...(provenance ? { provenance } : {}) } },
  };
  for (const f of SCALAR_FIELDS) {
    if (keys.includes(f.key)) patch[f.key] = f.pick(candidate);
  }
  if (keys.includes("features")) patch.features = candidate.features;
  for (const key of keys) {
    if (!key.startsWith("aspect:")) continue;
    const name = key.slice("aspect:".length);
    const values = candidate.aspects?.[name];
    if (values) patch.aspects = { ...(patch.aspects ?? {}), [name]: values };
  }
  return patch;
}
