"use client";

interface FeeEstimateProps {
  price: number;
  marketplace: 'ebay' | 'reverb' | 'etsy';
}

const FEE_RATES: Record<string, { rate: number; label: string }> = {
  ebay: { rate: 0.1325, label: 'eBay fees (13.25%)' },
  reverb: { rate: 0.08, label: 'Reverb fees (8%)' },
  etsy: { rate: 0.065, label: 'Etsy fees (6.5%)' },
};

export function FeeEstimate({ price, marketplace }: FeeEstimateProps) {
  const { rate, label } = FEE_RATES[marketplace] ?? FEE_RATES.ebay;
  const fees = Math.round(price * rate * 100) / 100;
  const net = Math.round((price - fees) * 100) / 100;

  return (
    <div className="space-y-1.5 text-[13px]" style={{ color: 'var(--flow-text)' }}>
      <div className="flex justify-between opacity-60">
        <span>Sale price</span>
        <span>${price.toFixed(2)}</span>
      </div>
      <div className="flex justify-between opacity-60">
        <span>{label}</span>
        <span>-${fees.toFixed(2)}</span>
      </div>
      <div className="h-px w-full" style={{ background: 'var(--flow-text)', opacity: 0.1 }} />
      <div className="flex justify-between font-semibold">
        <span>You earn</span>
        <span>${net.toFixed(2)}</span>
      </div>
    </div>
  );
}
