import type { TutorialTopic, CaptureManifest } from "./types";
import { setupTopic, setupManifest } from "./setup";
import { addingItemsTopic, addingItemsManifest } from "./adding-items";
import { listingsTopic, listingsManifest } from "./listings";
import { inventoryTopic, inventoryManifest } from "./inventory";

export type { TutorialTopic, TutorialStep, Overlay, OverlayType, CaptureAction, CaptureManifest } from "./types";

export const TUTORIAL_TOPICS: TutorialTopic[] = [setupTopic, addingItemsTopic, listingsTopic, inventoryTopic];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [setupManifest, addingItemsManifest, listingsManifest, inventoryManifest];

export function getTopic(slug: string): TutorialTopic | undefined {
  return TUTORIAL_TOPICS.find((t) => t.slug === slug);
}
