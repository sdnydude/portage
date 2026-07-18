"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface RequiredAspect {
  required: boolean;
  values: string[] | null;
  cardinality?: "SINGLE" | "MULTI";
}

// eBay publishes physical package aspects (all optional) in many categories —
// PC Laptops (177) carries Item Weight/Height/Length/Width, live-verified
// 2026-07-10. Portage owns those with dedicated weight & dimension fields
// (published via packageWeightAndSize), so rendering them as generic aspect
// inputs would duplicate the top-of-page fields as empty twins.
const PHYSICAL_DIMENSION_ASPECTS = new Set([
  "Item Weight",
  "Item Height",
  "Item Length",
  "Item Width",
  "Item Depth",
]);

function withoutPhysicalDimensions(
  aspects: Record<string, RequiredAspect>,
): Record<string, RequiredAspect> {
  return Object.fromEntries(
    Object.entries(aspects).filter(([name]) => !PHYSICAL_DIMENSION_ASPECTS.has(name)),
  );
}

/**
 * Fetches the eBay category's item-specific schema (which aspects are required
 * and their allowed values) so the listing flow can collect them up front
 * instead of failing at publish. Returns an empty map on any failure — the
 * server-side publish gate remains the backstop.
 */
export function useRequiredAspects(categoryId: string | null) {
  const { token } = useAuth();
  const [aspects, setAspects] = useState<Record<string, RequiredAspect>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token || !categoryId) {
      setAspects({});
      return;
    }
    let active = true;
    setIsLoading(true);
    api<{ aspects: Record<string, RequiredAspect> }>(`/marketplace/ebay/category-aspects/${categoryId}`, { token })
      .then((d) => { if (active) setAspects(withoutPhysicalDimensions(d.aspects ?? {})); })
      .catch(() => { if (active) setAspects({}); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token, categoryId]);

  return { aspects, isLoading };
}
