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
      // Ring the full settings list (Profile → Help & Support) per pixel
      // measurement of more-tab.png; stops short of the Log Out row, which
      // sits close to the tab bar.
      overlays: [{ type: "highlight", x: 5, y: 20, w: 90, h: 67 }],
    },
    {
      id: "marketplace-accounts",
      title: "Marketplace connections",
      body: "See connection status at a glance, reconnect if a token expires, or add a new marketplace as we launch them.",
      screenshot: "/tutorials/settings/marketplace-accounts.png",
      // Ring both eBay and Reverb rows (pixel-measured); old box started
      // after eBay's row and overshot far below Reverb into blank space.
      overlays: [{ type: "highlight", x: 5, y: 9, w: 90, h: 20 }],
    },
    {
      id: "help",
      title: "Help when you need it",
      body: "FAQs, support contact, and these tutorials — all under Help & Support. We typically respond within 24 hours.",
      screenshot: "/tutorials/settings/help.png",
      // help.png recaptured post-#231: the Tutorials card now leads the page
      // (9–18%) — ring it instead of floating a callout over the FAQ list.
      overlays: [{ type: "highlight", x: 4, y: 8, w: 92, h: 11 }],
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
