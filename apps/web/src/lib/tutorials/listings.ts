import type { TutorialTopic, CaptureManifest } from "./types";

export const listingsTopic: TutorialTopic = {
  slug: "listings",
  title: "Listings",
  description: "Create, publish, and manage marketplace listings.",
  steps: [
    {
      id: "listings-tab",
      title: "All your listings, one place",
      body: "The Listings tab shows every active and sold listing across eBay and Reverb, with live status. No more juggling seller dashboards.",
      screenshot: "/tutorials/listings/listings-tab.png",
      overlays: [{ type: "highlight", x: 6, y: 18, w: 88, h: 30 }],
    },
    {
      id: "create-listing",
      title: "List in the style you like",
      body: "Create a listing conversationally with Porter, swipe through quick cards, or use the hybrid flow. Same result: title, description, pricing, and photos — AI-drafted, marketplace-ready.",
      screenshot: "/tutorials/listings/create-listing.png",
      overlays: [{ type: "callout", x: 50, y: 25, text: "Pick your flow — you can switch anytime", delay: 300 }],
    },
    {
      id: "manage-listing",
      title: "Edit from the item hub",
      body: "Tap any listing to open its item page — the single place to edit details, sync changes to the marketplace, or end a listing. Changes publish back with one tap.",
      screenshot: "/tutorials/listings/manage-listing.png",
      overlays: [{ type: "highlight", x: 6, y: 55, w: 88, h: 25 }],
    },
  ],
};

export const listingsManifest: CaptureManifest = {
  topic: "listings",
  actions: [
    { type: "goto", path: "/listings" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "listings-tab" },
    { type: "goto", path: "/list" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "create-listing" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 800 },
    { type: "click", selector: "[data-testid='item-card'], a[href^='/inventory/']" },
    { type: "wait", ms: 1200 },
    { type: "capture", step: "manage-listing" },
  ],
};
