"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Reverb category cascade (Product Type → Subcategory 1 → 2 → 3), fed from
 * GET /marketplace/reverb/product-types and /subcategories?parent=<uuid>.
 * Controlled + dumb like ShippingFieldsSection: `value` is the deepest chosen
 * node (null = no explicit choice — server enrichment/AI defaults apply);
 * every selection reports the deepest selected node via onChange. The AI's
 * resolved path arrives as `value` and renders as a breadcrumb; the seller can
 * stop at any level (deepest-confident, not forced-leaf).
 */
export interface ReverbCategoryNode {
  uuid: string;
  fullName: string;
  name: string;
  rootUuid: string;
  listable: boolean;
}

interface ReverbCategorySectionProps {
  value: { uuid: string; fullName: string } | null;
  onChange: (value: { uuid: string; fullName: string } | null) => void;
  token: string | null;
  idPrefix?: string;
}

const selectClass =
  "w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none";
const labelClass =
  "block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5";

export function ReverbCategorySection({ value, onChange, token, idPrefix = "" }: ReverbCategorySectionProps) {
  const [roots, setRoots] = useState<ReverbCategoryNode[]>([]);
  // Chosen path, deepest last. Each entry also caches the children fetched for it.
  const [path, setPath] = useState<ReverbCategoryNode[]>([]);
  const [childrenByUuid, setChildrenByUuid] = useState<Record<string, ReverbCategoryNode[]>>({});

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ productTypes: ReverbCategoryNode[] }>("/marketplace/reverb/product-types", { token });
        if (!cancelled && r?.productTypes) setRoots(r.productTypes);
      } catch { /* cascade stays empty; server enrichment still applies */ }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const loadChildren = async (uuid: string) => {
    if (childrenByUuid[uuid]) return childrenByUuid[uuid];
    try {
      const r = await api<{ subcategories: ReverbCategoryNode[] }>(`/marketplace/reverb/subcategories?parent=${encodeURIComponent(uuid)}`, { token: token! });
      const kids = r?.subcategories ?? [];
      setChildrenByUuid((prev) => ({ ...prev, [uuid]: kids }));
      return kids;
    } catch {
      return [];
    }
  };

  const pickAt = async (level: number, uuid: string) => {
    if (!uuid) {
      // "(choose)" — truncate to the parent level; parent (if any) is the choice.
      const kept = path.slice(0, level);
      setPath(kept);
      const deepest = kept[kept.length - 1];
      onChange(deepest ? { uuid: deepest.uuid, fullName: deepest.fullName } : null);
      return;
    }
    const pool = level === 0 ? roots : childrenByUuid[path[level - 1].uuid] ?? [];
    const node = pool.find((c) => c.uuid === uuid);
    if (!node) return;
    const next = [...path.slice(0, level), node];
    setPath(next);
    onChange({ uuid: node.uuid, fullName: node.fullName });
    void loadChildren(node.uuid);
  };

  // Levels to render: one select per chosen level + one more if the deepest
  // chosen node has children.
  const levels: Array<{ label: string; pool: ReverbCategoryNode[]; chosen: string }> = [
    { label: "Product type", pool: roots, chosen: path[0]?.uuid ?? "" },
  ];
  for (let i = 0; i < path.length; i++) {
    const kids = childrenByUuid[path[i].uuid] ?? [];
    if (kids.length > 0) {
      levels.push({ label: `Subcategory ${i + 1}`, pool: kids, chosen: path[i + 1]?.uuid ?? "" });
    }
  }

  return (
    <div className="space-y-3">
      {value && (
        <p className="text-xs text-text-secondary">
          Category: <span className="text-text-primary font-medium">{value.fullName}</span>
        </p>
      )}
      {levels.map((lvl, i) => (
        <div key={`${lvl.label}-${i}`}>
          <label htmlFor={`${idPrefix}reverb-cat-${i}`} className={labelClass}>{lvl.label}</label>
          <select
            id={`${idPrefix}reverb-cat-${i}`}
            value={lvl.chosen}
            onChange={(e) => { void pickAt(i, e.target.value); }}
            className={selectClass}
          >
            <option value="">{i === 0 ? "AI / profile default" : "Stop here (use parent)"}</option>
            {lvl.pool.filter((c) => c.listable).map((c) => (
              <option key={c.uuid} value={c.uuid}>{c.name}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
