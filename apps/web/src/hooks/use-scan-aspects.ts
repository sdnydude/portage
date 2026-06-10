"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useRequiredAspects } from "./use-required-aspects";
import { suggestAspectValues } from "@/lib/aspect-seeding";

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  conditionIds: string[];
}

export function useScanAspects(editName: string, itemText: string) {
  const { token } = useAuth();
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string | null>(null);
  const [resolvedCategoryName, setResolvedCategoryName] = useState<string | null>(null);
  const [conditionIds, setConditionIds] = useState<string[]>([]);
  const [isCategoryResolving, setIsCategoryResolving] = useState(false);
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});

  // Aspect schema comes from the existing hook — no duplicate fetch here.
  const { aspects, isLoading: isAspectsLoading } = useRequiredAspects(resolvedCategoryId);

  // Stale-aspect publish corruption guard: confirmed values belong to a
  // category's schema; when the resolved category changes they must be cleared.
  useEffect(() => {
    setAspectValues({});
  }, [resolvedCategoryId]);

  const setAspectValue = useCallback((name: string, value: string) => {
    setAspectValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Suggestions recompute whenever the schema (new category) or item text
  // changes; aspect names already confirmed in aspectValues are excluded.
  const suggestions = useMemo(() => {
    const seeded = suggestAspectValues(itemText, aspects);
    const remaining: Record<string, string[]> = {};
    for (const [name, values] of Object.entries(seeded)) {
      if ((aspectValues[name] ?? "").trim() === "") remaining[name] = values;
    }
    return remaining;
  }, [itemText, aspects, aspectValues]);

  // Ref-backed so buildAspects keeps a stable identity across renders while
  // always reading the latest confirmed values.
  const aspectValuesRef = useRef(aspectValues);
  useEffect(() => {
    aspectValuesRef.current = aspectValues;
  }, [aspectValues]);
  const buildAspects = useCallback(() => {
    const built: Record<string, string[]> = {};
    for (const [name, value] of Object.entries(aspectValuesRef.current)) {
      const trimmed = value.trim();
      if (trimmed !== "") built[name] = [trimmed];
    }
    return built;
  }, []);

  const missingRequired = useMemo(
    () =>
      Object.entries(aspects)
        .filter(
          ([name, aspect]) =>
            aspect.required && (aspectValues[name] ?? "").trim() === "",
        )
        .map(([name]) => name),
    [aspects, aspectValues],
  );

  // Confirming a suggestion writes it into aspectValues; the suggestions memo
  // above then drops the name automatically (confirmed names are excluded).
  const confirmSuggestion = useCallback(
    (name: string, value: string) => {
      setAspectValue(name, value);
    },
    [setAspectValue],
  );

  // Race guard (same semantics as the active-flag cleanup in use-required-aspects,
  // sequence-based so the manually callable resolveCategory shares it): every
  // resolution bumps the sequence; stale settlers see a newer sequence and are
  // discarded — latest wins.
  const requestSeq = useRef(0);

  const resolveCategory = useCallback(
    async (name: string) => {
      const seq = ++requestSeq.current;
      if (!token || name.trim() === "") {
        setResolvedCategoryId(null);
        setResolvedCategoryName(null);
        setConditionIds([]);
        setIsCategoryResolving(false);
        return;
      }
      setIsCategoryResolving(true);
      try {
        const data = await api<{ suggestion: CategorySuggestion | null }>(
          `/marketplace/ebay/category-suggestion?q=${encodeURIComponent(name)}`,
          { token },
        );
        if (seq !== requestSeq.current) return;
        if (data.suggestion) {
          setResolvedCategoryId(data.suggestion.categoryId);
          setResolvedCategoryName(data.suggestion.categoryName);
          setConditionIds(data.suggestion.conditionIds ?? []);
        } else {
          // Graceful degrade — no match is not an error state.
          setResolvedCategoryId(null);
          setResolvedCategoryName(null);
          setConditionIds([]);
        }
      } catch {
        // Transient failure (network, 5xx): retain the previous resolution.
        // Clearing here would cascade into the aspect-value wipe effect and
        // destroy user-confirmed values; only a confirmed "no match"
        // (suggestion: null) resets the resolved state.
      } finally {
        if (seq === requestSeq.current) setIsCategoryResolving(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (editName.trim() === "") {
      requestSeq.current++; // invalidate any in-flight resolution
      setResolvedCategoryId(null);
      setResolvedCategoryName(null);
      setConditionIds([]);
      setIsCategoryResolving(false);
      return;
    }
    // Debounce absorbs both programmatic candidate switches and manual typing.
    // Resolving is flagged for the whole debounce+fetch window so publish
    // gating (aspectsBlockPublish) holds from the moment the name changes.
    setIsCategoryResolving(true);
    const timer = setTimeout(() => {
      void resolveCategory(editName);
    }, 500);
    return () => clearTimeout(timer);
  }, [editName, resolveCategory]);

  return {
    resolvedCategoryId,
    resolvedCategoryName,
    conditionIds,
    isCategoryResolving,
    isAspectsLoading,
    aspects,
    aspectValues,
    setAspectValue,
    suggestions,
    confirmSuggestion,
    missingRequired,
    buildAspects,
    // Gating stays true through resolution so the publish button cannot be
    // pressed against a not-yet-loaded (or about-to-change) aspect schema.
    aspectsBlockPublish:
      missingRequired.length > 0 || isCategoryResolving || isAspectsLoading,
    resolveCategory,
  };
}
