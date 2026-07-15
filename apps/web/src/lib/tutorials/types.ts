// Tutorial content model. Coords are % of the screenshot's natural size (0–100).
// These modules are imported by the Playwright capture script under tsx —
// keep them React-free (plain data only).

export type OverlayType = "highlight" | "tap" | "callout" | "swipe";

export interface Overlay {
  type: OverlayType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  delay?: number; // ms before the animation starts
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  screenshot: string; // public path, e.g. /tutorials/setup/connect-marketplaces.png
  overlays: Overlay[];
}

export interface TutorialTopic {
  slug: string;
  title: string;
  description: string;
  steps: TutorialStep[];
}

export type CaptureAction =
  | { type: "goto"; path: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "wait"; ms: number }
  | { type: "capture"; step: string };

export interface CaptureManifest {
  topic: string;
  actions: CaptureAction[];
}
