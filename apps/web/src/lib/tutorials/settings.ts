import type { TutorialTopic, CaptureManifest } from "./types";

export const settingsTopic: TutorialTopic = {
  slug: "settings",
  title: "Settings Tour",
  description: "Profile, marketplaces, billing, notifications, help.",
  steps: [
    {
      id: "more-tab",
      title: "Everything lives under More",
      body: "Profile, Billing & Plan, Marketplace Accounts, Messages, Seller Profile, Notifications, and Help — all one tap from the More tab.",
      screenshot: "/tutorials/settings/more-tab.png",
      overlays: [{ type: "highlight", x: 6, y: 30, w: 88, h: 45 }],
    },
    {
      id: "marketplace-accounts",
      title: "Marketplace connections",
      body: "See connection status at a glance, reconnect if a token expires, or add a new marketplace as we launch them.",
      screenshot: "/tutorials/settings/marketplace-accounts.png",
      overlays: [{ type: "highlight", x: 8, y: 25, w: 84, h: 25 }],
    },
    {
      id: "help",
      title: "Help when you need it",
      body: "FAQs, support contact, and these tutorials — all under Help & Support. We typically respond within 24 hours.",
      screenshot: "/tutorials/settings/help.png",
      overlays: [{ type: "callout", x: 50, y: 25, text: "Come back to tutorials anytime", delay: 300 }],
    },
  ],
};

export const settingsManifest: CaptureManifest = {
  topic: "settings",
  actions: [
    { type: "goto", path: "/more" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "more-tab" },
    { type: "goto", path: "/settings/marketplace" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "marketplace-accounts" },
    { type: "goto", path: "/settings/help" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "help" },
  ],
};
