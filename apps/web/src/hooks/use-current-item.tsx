"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface CurrentItemValue {
  /** The item id currently on screen (e.g. inventory/[id]), or null. */
  itemId: string | null;
  setCurrentItem: (id: string | null) => void;
}

const CurrentItemContext = createContext<CurrentItemValue | null>(null);

/**
 * Publishes the on-screen item id app-wide (Phase R3) so the Porter dock can be
 * context-aware. Item detail views call setCurrentItem on mount / clear on
 * unmount; the dock reads itemId.
 */
export function CurrentItemProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [itemId, setItemId] = useState<string | null>(null);
  const setCurrentItem = useCallback((id: string | null) => setItemId(id), []);
  const value = useMemo(
    () => ({ itemId, setCurrentItem }),
    [itemId, setCurrentItem],
  );
  return (
    <CurrentItemContext value={value}>
      {children}
    </CurrentItemContext>
  );
}

const NO_PROVIDER: CurrentItemValue = {
  itemId: null,
  setCurrentItem: () => {},
};

/**
 * Reads the current-item context. Degrades to a null-op default outside a
 * provider — the dock is an optional enhancement, so item views (and their
 * tests) must render fine whether or not the provider is mounted.
 */
export function useCurrentItem(): CurrentItemValue {
  return use(CurrentItemContext) ?? NO_PROVIDER;
}

/**
 * Publish an item id as the on-screen item for the lifetime of the caller.
 * Item detail views call this; it clears on unmount so the dock loses context
 * when the user navigates away.
 */
export function usePublishCurrentItem(itemId: string | null): void {
  const { setCurrentItem } = useCurrentItem();
  useEffect(() => {
    setCurrentItem(itemId);
    return () => setCurrentItem(null);
  }, [itemId, setCurrentItem]);
}
