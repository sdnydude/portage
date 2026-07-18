import type { TutorialTopic, CaptureManifest } from "./types";

export const porterTopic: TutorialTopic = {
  slug: "porter",
  title: "Porter AI",
  description: "Your selling assistant — ask anything about your inventory.",
  steps: [
    {
      id: "porter-tab",
      title: "Meet Porter",
      body: "Porter is your AI selling assistant. Ask about your inventory, get stats, or have it suggest what to list next — in plain English.",
      screenshot: "/tutorials/porter/porter-tab.png",
      overlays: [{ type: "callout", x: 50, y: 40, text: "Ask anything", delay: 300 }],
    },
    {
      id: "porter-ask",
      title: "Ask in your own words",
      body: "“What's my most valuable unlisted item?” “How many guitars do I have?” Porter searches your real inventory and answers with the data.",
      screenshot: "/tutorials/porter/porter-ask.png",
      overlays: [{ type: "highlight", x: 3, y: 82, w: 94, h: 7 }],
    },
    {
      id: "action-pills",
      title: "Act on the answer",
      body: "Porter's replies include action pills — tap one to jump straight to the item, start a listing, or open your stats. Conversation to action in one tap.",
      screenshot: "/tutorials/porter/action-pills.png",
      overlays: [{ type: "callout", x: 50, y: 58, text: "Pills appear here", delay: 300 }],
    },
  ],
};

export const porterManifest: CaptureManifest = {
  topic: "porter",
  actions: [
    { type: "goto", path: "/porter" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "porter-tab" },
    // input-tag-scoped: the plan's `textarea, input[type='text']` would match
    // the CSS-hidden TopBar AskPorterBar textarea first (mounted since the R0
    // shell). The porter page's own chat input is an input[type='text'] with
    // this placeholder.
    { type: "fill", selector: "input[type='text'][placeholder*='Ask Porter']", value: "What's my most valuable unlisted item?" },
    { type: "wait", ms: 400 },
    { type: "capture", step: "porter-ask" },
    { type: "capture", step: "action-pills" },
  ],
};
