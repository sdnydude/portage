"use client";

import { useRouter } from "next/navigation";
import { formatPrice, formatMarketplace } from "@/lib/format";

interface PublishSuccessProps {
  listingId: string;
  marketplace: 'ebay' | 'reverb' | 'etsy';
  title: string;
  price: number;
  photoUrl: string | null;
  isFirstListing: boolean;
  onListAnother: () => void;
  // Marketplace publish fell back to draft — carries the marketplace's reason
  warning?: string;
}

export function PublishSuccess({
  listingId, marketplace, title, price, photoUrl,
  isFirstListing, onListAnother, warning,
}: PublishSuccessProps) {
  const router = useRouter();
  const showDiscovery = isFirstListing;

  const marketplaceLabel = formatMarketplace(marketplace);

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" style={{ color: 'var(--flow-text)' }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: warning ? '#f59e0b' : 'var(--flow-accent)', opacity: 0.15 }}>
        {warning ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--flow-accent)" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <h2 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-1">
        {warning ? 'Saved as draft' : 'Listed!'}
      </h2>
      <p className="text-sm opacity-60 mb-6">
        {warning ? `Created on ${marketplaceLabel} as a draft` : `Published on ${marketplaceLabel}`}
      </p>

      {warning && (
        <div
          role="alert"
          className="w-full max-w-xs rounded-xl p-3 mb-6 text-left text-[13px] border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
        >
          {warning}
        </div>
      )}

      <div className="w-full max-w-xs rounded-xl p-4 mb-6" style={{ background: 'var(--flow-text)', opacity: 0.05 }}>
        {photoUrl && (
          <div className="w-full h-32 rounded-lg mb-3 overflow-hidden bg-black/5">
            <img src={photoUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <p className="font-semibold text-[15px] mb-1">{title}</p>
        <p className="text-lg font-bold" style={{ color: 'var(--flow-accent)' }}>{formatPrice(price, 2)}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => router.push('/inventory')}
          className="w-full py-3 rounded-xl font-semibold text-white text-[15px]"
          style={{ background: 'var(--flow-accent)' }}
        >
          Back to Inventory
        </button>
        <button
          onClick={() => router.push(`/listings/${listingId}`)}
          className="w-full py-3 rounded-xl font-semibold text-[15px] border"
          style={{ color: 'var(--flow-accent)', borderColor: 'var(--flow-accent)' }}
        >
          View Listing
        </button>
        <button
          onClick={onListAnother}
          className="w-full py-3 rounded-xl font-semibold text-[15px] border"
          style={{ color: 'var(--flow-accent)', borderColor: 'var(--flow-accent)' }}
        >
          List Another
        </button>
      </div>

      {showDiscovery && (
        <div className="mt-6 p-4 rounded-xl text-left w-full max-w-xs" style={{ background: 'var(--flow-text)', opacity: 0.05 }}>
          <p className="text-[13px] font-medium mb-1">Try a different listing style?</p>
          <p className="text-[12px] opacity-60 mb-2">
            You used Hybrid mode. There are two other listing styles — check them out in Settings.
          </p>
          <button
            onClick={() => router.push('/settings')}
            className="text-[12px] font-semibold"
            style={{ color: 'var(--flow-accent)' }}
          >
            Go to Settings →
          </button>
        </div>
      )}
    </div>
  );
}
