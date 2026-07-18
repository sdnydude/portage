"use client";

interface MasterDetailProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  listLabel: string;
}

/**
 * Desktop (lg+) two-pane workbench: fixed-width scrolling list + fluid detail.
 * Height pins to the viewport minus the 64px sticky TopBar so each pane
 * scrolls independently — no page swaps (Phase R1).
 */
export function MasterDetail({ list, detail, listLabel }: MasterDetailProps) {
  return (
    <div data-testid="workbench" className="hidden h-[calc(100dvh-4rem)] min-w-0 lg:flex">
      <section
        aria-label={listLabel}
        className="w-[380px] shrink-0 overflow-y-auto border-r border-border"
      >
        {list}
      </section>
      <section className="min-w-0 flex-1 overflow-y-auto">{detail}</section>
    </div>
  );
}
