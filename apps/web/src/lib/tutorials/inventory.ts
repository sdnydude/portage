import type { TutorialTopic, CaptureManifest } from "./types";

export const inventoryTopic: TutorialTopic = {
  slug: "inventory",
  title: "Inventory",
  description: "Browse, search, and bulk-manage your catalog.",
  steps: [
    {
      id: "browse",
      title: "Your personal catalog",
      body: "Everything you've scanned lives in Inventory — with photos, values, and listing status. Grid or list view, your choice.",
      screenshot: "/tutorials/inventory/browse.png",
      overlays: [{ type: "highlight", x: 6, y: 24, w: 88, h: 38 }],
    },
    {
      id: "search",
      title: "Find anything fast",
      body: "Search by name, filter by status, sort by value or date. The Unlisted badge shows what's sitting idle — your next listing candidates.",
      screenshot: "/tutorials/inventory/search.png",
      // Verified: search bar sits at ~18–22% (Ask Porter bar is above it).
      overlays: [{ type: "tap", x: 50, y: 20 }],
    },
    {
      id: "bulk",
      title: "Bulk actions",
      body: "Select multiple items to archive, activate, delete, or export as an eBay-ready CSV in one move.",
      screenshot: "/tutorials/inventory/bulk.png",
      overlays: [{ type: "callout", x: 50, y: 65, text: "Select → bulk bar", delay: 300 }],
    },
  ],
};

export const inventoryManifest: CaptureManifest = {
  topic: "inventory",
  actions: [
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "browse" },
    { type: "click", selector: "input[type='search'], [placeholder*='Search']" },
    { type: "wait", ms: 400 },
    { type: "capture", step: "search" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "bulk" },
  ],
};
