import type { TutorialTopic, CaptureManifest } from "./types";

export const addingItemsTopic: TutorialTopic = {
  slug: "adding-items",
  title: "Adding Items",
  description: "Scan with your camera or add items manually.",
  steps: [
    {
      id: "scan-home",
      title: "Scan anything",
      body: "Tap the orange Scan button in the middle of the tab bar. Point your camera at an item — Porter's AI identifies it, estimates value, and drafts the details for you.",
      screenshot: "/tutorials/adding-items/scan-home.png",
      overlays: [{ type: "tap", x: 58, y: 93 }],
    },
    {
      id: "inventory-add",
      title: "Add photos your way",
      body: "Inside a scan you can add more shots from camera or gallery — up to 24 photos per item. Long-press any photo tile to drag it into a new order; the first photo is your hero shot.",
      screenshot: "/tutorials/adding-items/inventory-add.png",
      overlays: [{ type: "swipe", x: 30, y: 40, text: "Long-press, then drag" }],
    },
    {
      id: "item-detail",
      title: "Review and refine",
      body: "Every item gets a detail page: photos, condition, value estimate, and AI-drafted description. Edit anything — your input always wins over the AI's suggestion.",
      screenshot: "/tutorials/adding-items/item-detail.png",
      overlays: [{ type: "highlight", x: 4, y: 8, w: 92, h: 40 }],
    },
  ],
};

export const addingItemsManifest: CaptureManifest = {
  topic: "adding-items",
  actions: [
    { type: "goto", path: "/" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "scan-home" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "inventory-add" },
    { type: "click", selector: "[data-testid='item-card'], a[href^='/inventory/']" },
    { type: "wait", ms: 1200 },
    { type: "capture", step: "item-detail" },
  ],
};
