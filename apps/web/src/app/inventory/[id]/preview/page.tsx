"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toBlob } from "html-to-image";
import { useItem } from "@/hooks/use-item";
import { useListings } from "@/hooks/use-listings";
import { resolvePublishPriceWithSource } from "@/lib/price";
import { ListingPreviewShareCard } from "@/components/listing/listing-preview-share-card";

/**
 * Sharable buyer-eye preview (listing-hub Task 5): renders the share card and
 * captures it as a PNG — native share sheet where available, download
 * fallback elsewhere.
 */
export default function ListingPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { item, isLoading } = useItem(params.id);
  const { listings } = useListings({ itemId: params.id });
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (isLoading || !item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Price: the active listing's price if one exists, else the same fallback
  // chain the publish sheet uses (item price → estimates; no comps here).
  const activeListing = listings.find((l) => l.status === "active");
  const price = activeListing?.price ?? resolvePublishPriceWithSource(item, null).price;

  async function handleShare() {
    if (!cardRef.current || sharing || !item) return;
    setSharing(true);
    setShareError(null);
    try {
      // Readiness guard: toBlob serializes the DOM immediately — a
      // still-streaming hero renders as a blank region in the PNG (Safari's
      // foreignObject pipeline drops undecoded images even post-onload).
      await Promise.all(
        [...cardRef.current.querySelectorAll("img")].map((i) => i.decode().catch(() => {})),
      );
      const blob = await toBlob(cardRef.current, { pixelRatio: 2 });
      if (!blob) throw new Error("capture failed");
      const file = new File([blob], `${item.title.slice(0, 40)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: item.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // User cancelling the share sheet is not an error.
      if ((err as Error).name !== "AbortError") {
        setShareError("Couldn't create the share image. Try again.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-text-secondary" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="px-4 py-2 rounded-xl bg-forest-green text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {sharing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {sharing ? "Preparing..." : "Share"}
          </button>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-3">
        {shareError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {shareError}
          </div>
        )}
        <div ref={cardRef}>
          <ListingPreviewShareCard item={item} price={price} />
        </div>
      </div>
    </div>
  );
}
