import type { TutorialTopic, CaptureManifest } from "./types";
import { setupTopic, setupManifest } from "./setup";
import { addingItemsTopic, addingItemsManifest } from "./adding-items";
import { listingsTopic, listingsManifest } from "./listings";
import { inventoryTopic, inventoryManifest } from "./inventory";
import { ordersTopic, ordersManifest } from "./orders";
import { settingsTopic, settingsManifest } from "./settings";
import { porterTopic, porterManifest } from "./porter";
import { messagesTopic, messagesManifest } from "./messages";

export type { TutorialTopic, TutorialStep, Overlay, OverlayType, CaptureAction, CaptureManifest } from "./types";

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  setupTopic, addingItemsTopic, listingsTopic, inventoryTopic,
  ordersTopic, settingsTopic, porterTopic, messagesTopic,
];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [
  setupManifest, addingItemsManifest, listingsManifest, inventoryManifest,
  ordersManifest, settingsManifest, porterManifest, messagesManifest,
];

export function getTopic(slug: string): TutorialTopic | undefined {
  return TUTORIAL_TOPICS.find((t) => t.slug === slug);
}
