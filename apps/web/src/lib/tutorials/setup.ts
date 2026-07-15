import type { TutorialTopic, CaptureManifest } from "./types";

export const setupTopic: TutorialTopic = {
  slug: "setup",
  title: "Get Set Up",
  description: "Connect marketplaces, set seller defaults, pick a plan.",
  steps: [
    {
      id: "connect-marketplaces",
      title: "Connect your marketplaces",
      body: "Head to Settings → Marketplace Accounts and connect eBay and Reverb. Porter lists to every marketplace you connect — one flow, no re-typing.",
      screenshot: "/tutorials/setup/connect-marketplaces.png",
      overlays: [
        // Verified against the captured PNG: both marketplace cards sit at 8–29%.
        { type: "highlight", x: 4, y: 8, w: 92, h: 21 },
        { type: "callout", x: 50, y: 33, text: "Tap Connect on each marketplace", delay: 400 },
      ],
    },
    {
      id: "seller-profile",
      title: "Set your seller defaults",
      body: "Your return policy, shipping preferences, and item location live in Seller Profile. Set them once — every new listing inherits them automatically.",
      screenshot: "/tutorials/setup/seller-profile.png",
      overlays: [{ type: "highlight", x: 8, y: 20, w: 84, h: 30 }],
    },
    {
      id: "billing",
      title: "Pick your plan",
      body: "Billing & Plan shows your tier, usage, and credits. Upgrade any time — AI scans, background removal, and enhancements are metered by plan.",
      screenshot: "/tutorials/setup/billing.png",
      overlays: [{ type: "callout", x: 50, y: 30, text: "Your current plan and usage", delay: 300 }],
    },
  ],
};

export const setupManifest: CaptureManifest = {
  topic: "setup",
  actions: [
    { type: "goto", path: "/settings/marketplace" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "connect-marketplaces" },
    { type: "goto", path: "/settings/seller-profile" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "seller-profile" },
    { type: "goto", path: "/settings/billing" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "billing" },
  ],
};
