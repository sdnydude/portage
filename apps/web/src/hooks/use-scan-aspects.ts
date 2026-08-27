"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useRequiredAspects } from "./use-required-aspects";
import { suggestAspectValues, mergeAspectSuggestions, autoFillFromAi } from "@/lib/aspect-seeding";

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  conditionIds: string[];
}

export function useScanAspects(
  editName: string,
  itemText: string,
  aiAspects?: Record<string, string[]>,
  // Vision scan's coarse category — sent to the suggestion endpoint so the
  // server can flag implausible suggestions (advisory only, never blocks).
  visionCategory?: string,
) {
  const { token } = useAuth();
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string | null>(null);
  const [resolvedCategoryName, setResolvedCategoryName] = useState<string | null>(null);
  const [conditionIds, setConditionIds] = useState<string[]>([]);
  const [categoryMismatch, setCategoryMismatch] = useState(false);
  // The visionCategory value the CURRENT resolution was computed against —
  // banner text must quote this snapshot, not the live candidate prop, or a
  // failed re-resolve after a candidate switch mixes two candidates' data.
  const [resolvedVisionCategory, setResolvedVisionCategory] = useState<string | undefined>(undefined);
  // "Use anyway" is a per-category decision: remember which categoryId was
  // dismissed so a re-resolution to the SAME category (title typo fix) doesn't
  // resurrect the banner; a different category is a new situation.
  const dismissedCategoryIdRef = useRef<string | null>(null);
  // Ref mirror of resolvedCategoryId so dismissCategoryMismatch keeps a stable identity.
  const resolvedIdRef = useRef<string | null>(null);
  const [isCategoryResolving, setIsCategoryResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});
  // Names whose current value was auto-filled from the AI scan and not yet edited
  // by the seller — drives the [AI] provenance tag on the filled field.
  const [aiFilledNames, setAiFilledNames] = useState<string[]>([]);

  // Aspect schema comes from the existing hook — no duplicate fetch here.
  const { aspects, isLoading: isAspectsLoading, isError: aspectsError, refetch: refetchAspects } = useRequiredAspects(resolvedCategoryId);

  // Stale-aspect publish corruption guard: confirmed values belong to a
  // category's schema; when the resolved category changes they must be cleared.
  useEffect(() => {
    setAspectValues({});
    setAiFilledNames([]);
  }, [resolvedCategoryId]);

  const setAspectValue = useCallback((name: string, value: string) => {
    setAspectValues((prev) => ({ ...prev, [name]: value }));
    // A manual edit makes the value seller-owned — drop its [AI] tag.
    setAiFilledNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : prev));
  }, []);

  // Suggestions recompute whenever the schema (new category) or item text
  // changes; aspect names already confirmed in aspectValues are excluded.
  // Deterministic text-matched seeds remain tap-to-confirm chips for aspects the
  // AI did NOT fill (lower-confidence regex matches); AI values auto-fill above.
  const suggestions = useMemo(() => {
    const seeded = suggestAspectValues(itemText, aspects);
    return mergeAspectSuggestions(aiAspects, seeded, aspects, aspectValues).suggestions;
  }, [itemText, aspects, aspectValues, aiAspects]);

  // Ref-backed so buildAspects keeps a stable identity across renders while
  // always reading the latest confirmed values.
  const aspectValuesRef = useRef(aspectValues);
  useEffect(() => {
    aspectValuesRef.current = aspectValues;
  }, [aspectValues]);

  // AI-scanned specifics fill the fields directly (editable, [AI]-tagged) rather
  // than as tap-to-confirm chips. Idempotent: autoFillFromAi only returns names
  // not already present, so once filled there's nothing to add and it no-ops.
  useEffect(() => {
    const { values, aiNames } = autoFillFromAi(aiAspects, aspects, aspectValuesRef.current);
    if (aiNames.length === 0) return;
    setAspectValues((prev) => ({ ...prev, ...values }));
    setAiFilledNames((prev) => [...new Set([...prev, ...aiNames])]);
  }, [aspects, aiAspects]);
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
  const requestSeqRef = useRef(0);

  const resolveCategory = useCallback(
    async (name: string) => {
      const seq = ++requestSeqRef.current;
      if (!token || name.trim() === "") {
        setResolvedCategoryId(null);
        setResolvedCategoryName(null);
        setConditionIds([]);
        setCategoryMismatch(false);
        setIsCategoryResolving(false);
        setResolveError(false); // nothing to look up → no stale failure notice
        return;
      }
      setIsCategoryResolving(true);
      setResolveError(false);
      try {
        const visionParam = visionCategory?.trim()
          ? `&visionCategory=${encodeURIComponent(visionCategory)}`
          : "";
        const data = await api<{ suggestion: CategorySuggestion | null; mismatch?: boolean }>(
          `/marketplace/ebay/category-suggestion?q=${encodeURIComponent(name)}${visionParam}`,
          { token },
        );
        if (seq !== requestSeqRef.current) return;
        if (data.suggestion) {
          resolvedIdRef.current = data.suggestion.categoryId;
          setResolvedCategoryId(data.suggestion.categoryId);
          setResolvedCategoryName(data.suggestion.categoryName);
          setResolvedVisionCategory(visionCategory);
          setConditionIds(data.suggestion.conditionIds ?? []);
          setCategoryMismatch(
            data.mismatch === true
            && data.suggestion.categoryId !== dismissedCategoryIdRef.current,
          );
        } else {
          // Graceful degrade — no match is not an error state.
          setResolvedCategoryId(null);
          setResolvedCategoryName(null);
          setConditionIds([]);
          setCategoryMismatch(false);
        }
      } catch {
        // Transient failure (network, 5xx): retain the previous resolution.
        // Clearing here would cascade into the aspect-value wipe effect and
        // destroy user-confirmed values; only a confirmed "no match"
        // (suggestion: null) resets the resolved state. P3 (a5a2b944): the
        // failure is still TOLD — seq-guarded so a stale rejection can't
        // flag a newer, successful lookup.
        if (seq === requestSeqRef.current) setResolveError(true);
      } finally {
        if (seq === requestSeqRef.current) setIsCategoryResolving(false);
      }
    },
    [token, visionCategory],
  );

  useEffect(() => {
    if (editName.trim() === "") {
      requestSeqRef.current++; // invalidate any in-flight resolution
      setResolvedCategoryId(null);
      setResolvedCategoryName(null);
      setConditionIds([]);
      setCategoryMismatch(false);
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
    categoryMismatch,
    resolvedVisionCategory,
    dismissCategoryMismatch: useCallback(() => {
      dismissedCategoryIdRef.current = resolvedIdRef.current;
      setCategoryMismatch(false);
    }, []),
    // "Don't use it" — reject the suggestion outright: back to unresolved, so
    // saves fall through to the stored/vision category and publish resolves
    // later via the self-heal path. Bump the sequence so an in-flight
    // resolution can't resurrect the rejected suggestion.
    clearCategoryResolution: useCallback(() => {
      requestSeqRef.current++;
      // Rejection persists at least as strongly as "Use anyway": if a later
      // resolution returns the same category, don't re-flag it.
      dismissedCategoryIdRef.current = resolvedIdRef.current;
      resolvedIdRef.current = null;
      setResolvedCategoryId(null);
      setResolvedCategoryName(null);
      setConditionIds([]);
      setCategoryMismatch(false);
      setIsCategoryResolving(false);
    }, []),
    isCategoryResolving,
    isAspectsLoading,
    // P3 (125cbc53): the schema fetch failed — `aspects` is empty because we
    // don't KNOW, not because nothing is required. Surfaces as outage copy.
    aspectsError,
    refetchAspects,
    // P3 (a5a2b944): last category lookup failed (prior resolution retained).
    resolveError,
    aspects,
    aspectValues,
    setAspectValue,
    suggestions,
    aiFilledNames,
    confirmSuggestion,
    missingRequired,
    buildAspects,
    // Gating stays true through resolution so the publish button cannot be
    // pressed against a not-yet-loaded (or about-to-change) aspect schema; a
    // FAILED fetch (aspectsError) blocks the same way — "we don't know" must
    // never read as "nothing required" (P3 125cbc53).
    aspectsBlockPublish:
      missingRequired.length > 0 || isCategoryResolving || isAspectsLoading || aspectsError,
    resolveCategory,
  };
}
