import type { TutorialTopic, CaptureManifest } from "./types";
import { setupTopic, setupManifest } from "./setup";

export type { TutorialTopic, TutorialStep, Overlay, OverlayType, CaptureAction, CaptureManifest } from "./types";

export const TUTORIAL_TOPICS: TutorialTopic[] = [setupTopic];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [setupManifest];

export function getTopic(slug: string): TutorialTopic | undefined {
  return TUTORIAL_TOPICS.find((t) => t.slug === slug);
}
