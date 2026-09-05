import type { TutorialTopic, CaptureManifest } from "./types";

export const messagesTopic: TutorialTopic = {
  slug: "messages",
  title: "Messages",
  description: "Buyer conversations from eBay, answered in-app.",
  steps: [
    {
      id: "conversations",
      title: "Buyer messages, in one inbox",
      body: "eBay buyer messages sync into Portage. Unread counts show on Messages in the sidebar and your avatar menu so nothing slips.",
      screenshot: "/tutorials/messages/conversations.png",
      overlays: [{ type: "highlight", x: 10, y: 19, w: 80, h: 25 }],
    },
    {
      id: "thread",
      title: "Full conversation view",
      body: "Open a conversation to see the whole thread with the item attached for context.",
      screenshot: "/tutorials/messages/thread.png",
      overlays: [{ type: "highlight", x: 10, y: 19, w: 80, h: 25 }],
    },
    {
      id: "reply",
      title: "Reply without leaving",
      body: "Type your reply right here — it's delivered to the buyer through eBay. No dashboard hopping.",
      screenshot: "/tutorials/messages/reply.png",
      overlays: [{ type: "callout", x: 50, y: 60, text: "Reply box below", delay: 300 }],
    },
  ],
};

export const messagesManifest: CaptureManifest = {
  topic: "messages",
  actions: [
    { type: "goto", path: "/messages" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "conversations" },
    { type: "click", selector: "[data-testid='conversation-row'], a[href^='/messages/']" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "thread" },
    { type: "capture", step: "reply" },
  ],
};
