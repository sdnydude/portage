"use client";

import { useUserPreferences } from "@/hooks/use-user-preferences";

interface RecognitionForkProps {
  onListForSale: () => void;
  onSaveToInventory: () => void;
}

export function RecognitionFork({ onListForSale, onSaveToInventory }: RecognitionForkProps) {
  const { forkPref, forkCount, updatePrefs } = useUserPreferences();

  if (forkPref === 'list' || forkCount >= 5) {
    onListForSale();
    return null;
  }
  if (forkPref === 'inventory') {
    onSaveToInventory();
    return null;
  }

  const handleList = () => {
    updatePrefs({});
    onListForSale();
  };

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8">
      <h2 className="text-xl font-semibold font-[family-name:var(--font-instrument)]" style={{ color: 'var(--flow-text)' }}>
        What would you like to do?
      </h2>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleList}
          className="w-full py-3.5 rounded-xl font-semibold text-white text-[15px] transition-all active:scale-[0.97]"
          style={{ background: 'var(--flow-accent)' }}
        >
          List for Sale
        </button>
        <button
          onClick={onSaveToInventory}
          className="w-full py-3.5 rounded-xl font-semibold text-[15px] border transition-all active:scale-[0.97]"
          style={{ color: 'var(--flow-text)', borderColor: 'var(--flow-accent)', opacity: 0.7 }}
        >
          Save to Inventory
        </button>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--flow-text)', opacity: 0.4 }}>
        You can always list items later from your inventory
      </p>
    </div>
  );
}
