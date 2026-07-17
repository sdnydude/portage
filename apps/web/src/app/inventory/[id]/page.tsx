"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ItemDetail } from "@/components/inventory/item-detail";

// Suspense split: useSearchParams requires it (same reason as before the extraction).
function ItemDetailRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <ItemDetail
      itemId={params.id}
      focusListingId={searchParams.get("listing")}
      onDeleted={() => router.replace("/inventory")}
      onBack={() => router.back()}
    />
  );
}

export default function ItemDetailPage() {
  return (
    <Suspense fallback={null}>
      <ItemDetailRoute />
    </Suspense>
  );
}
