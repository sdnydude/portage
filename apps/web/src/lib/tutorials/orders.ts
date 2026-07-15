import type { TutorialTopic, CaptureManifest } from "./types";

export const ordersTopic: TutorialTopic = {
  slug: "orders",
  title: "Orders",
  description: "Track sales and ship with marketplace labels.",
  steps: [
    {
      id: "orders-tab",
      title: "Sales from every marketplace",
      body: "When something sells, it lands here — buyer, price, and date, synced automatically from eBay and Reverb.",
      screenshot: "/tutorials/orders/orders-tab.png",
      // Verified: demo account renders the empty state; ring its icon+copy block.
      overlays: [{ type: "highlight", x: 6, y: 25, w: 88, h: 20 }],
    },
    {
      id: "order-detail",
      title: "Everything about the sale",
      body: "Open an order for the full picture: item, shipping address, and payout. Mark it shipped once the label is on the box.",
      screenshot: "/tutorials/orders/order-detail.png",
      // Same empty-state screenshot as orders-tab — ring matches its exact
      // block bounds instead of oversizing into blank space below.
      overlays: [{ type: "highlight", x: 6, y: 25, w: 88, h: 20 }],
    },
    {
      id: "ship-it",
      title: "Ship It",
      body: "The Ship It button takes you straight to the marketplace's label purchase page with the order pre-selected — cheapest rates, no re-typing addresses.",
      screenshot: "/tutorials/orders/ship-it.png",
      // Same empty-state screenshot — no Ship It button is actually in
      // frame, so a tap ripple over blank space would falsely imply a
      // control exists. Callout in the dead space below the block instead.
      overlays: [{ type: "callout", x: 50, y: 46, text: "Appears on real orders", delay: 300 }],
    },
  ],
};

export const ordersManifest: CaptureManifest = {
  topic: "orders",
  actions: [
    { type: "goto", path: "/orders" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "orders-tab" },
    { type: "click", selector: "[data-testid='order-row'], a[href^='/orders/']" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "order-detail" },
    { type: "capture", step: "ship-it" },
  ],
};
