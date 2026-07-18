"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { ConversationalFlow } from "@/components/listing-flow/conversational-flow";
import { SwipeFlow } from "@/components/listing-flow/swipe-flow";
import { HybridFlow } from "@/components/listing-flow/hybrid-flow";

function ListContent() {
  const { preference, isLoading } = useUserPreferences();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('itemId') ?? undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--flow-bg, #F5F3EF)' }}>
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-30" />
      </div>
    );
  }

  switch (preference) {
    case 'conversational':
      return (
        <div className="compact-bar-clearance">
          <ConversationalFlow itemId={itemId} />
        </div>
      );
    case 'swipe':
      // SwipeFlow is a fixed-position (z-[60]) full-screen overlay — it
      // escapes normal document flow, so no clearance wrapper is needed.
      return <SwipeFlow itemId={itemId} />;
    case 'hybrid':
    default:
      return (
        <div className="compact-bar-clearance">
          <HybridFlow itemId={itemId} />
        </div>
      );
  }
}

export default function ListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-30" />
      </div>
    }>
      <ListContent />
    </Suspense>
  );
}
