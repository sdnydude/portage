"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { Listing } from "@/hooks/use-listings";

/**
 * Retired page (listing-hub Task 4): inventory/[id] is the single canonical
 * detail page. This route survives only as a resolver-redirect so external
 * bookmarks and history keep working — it resolves the listing's itemId and
 * lands on the hub's deep link (scroll + highlight handled there).
 */
export default function ListingRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  // AuthProvider blocks rendering until the session settles, so by the time
  // this runs isAuthenticated is truthful. Without this bounce a failed
  // session exchange (token null) leaves an infinite spinner — the old page
  // had exactly this guard, keep it.
  useEffect(() => {
    if (!isAuthenticated) router.replace("/listings");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    api<Listing>(`/listings/${id}`, { token })
      .then((l) => router.replace(`/inventory/${l.itemId}?listing=${l.id}`))
      .catch(() => router.replace("/listings"));
  }, [id, token, router]);

  // Spinner, not null — a blank page during the resolve round-trip reads as broken.
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-(--teal) border-t-transparent" />
    </div>
  );
}
