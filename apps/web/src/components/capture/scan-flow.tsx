"use client";

interface ScanFlowProps {
  onClose: () => void;
}

export function ScanFlow({ onClose }: ScanFlowProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-fade-in">
      <div className="text-center">
        <p className="text-white text-lg mb-4">Scan flow coming soon</p>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full bg-forest-green text-white text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
