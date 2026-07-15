import { describe, it, expect } from "vitest";
import { TUTORIAL_TOPICS, CAPTURE_MANIFESTS, getTopic } from "./index";

describe("tutorial content registry", () => {
  it("exposes the setup topic via registry and getTopic", () => {
    expect(TUTORIAL_TOPICS.length).toBeGreaterThanOrEqual(1);
    expect(getTopic("setup")?.title).toBe("Get Set Up");
    expect(getTopic("nope")).toBeUndefined();
  });

  it("every overlay coordinate is within 0–100", () => {
    for (const topic of TUTORIAL_TOPICS)
      for (const step of topic.steps)
        for (const o of step.overlays) {
          expect(o.x, `${topic.slug}/${step.id}`).toBeGreaterThanOrEqual(0);
          expect(o.x).toBeLessThanOrEqual(100);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeLessThanOrEqual(100);
          if (o.w != null) expect(o.x + o.w).toBeLessThanOrEqual(100);
          if (o.h != null) expect(o.y + o.h).toBeLessThanOrEqual(100);
        }
  });

  it("every screenshot path lives under /tutorials/<slug>/", () => {
    for (const topic of TUTORIAL_TOPICS)
      for (const step of topic.steps)
        expect(step.screenshot, `${topic.slug}/${step.id}`).toMatch(
          new RegExp(`^/tutorials/${topic.slug}/[a-z0-9-]+\\.png$`),
        );
  });

  it("step ids are unique within each topic and non-empty", () => {
    for (const topic of TUTORIAL_TOPICS) {
      const ids = topic.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(topic.steps.length).toBeGreaterThan(0);
    }
  });

  it("registers all 8 topics in hub order", () => {
    expect(TUTORIAL_TOPICS.map((t) => t.slug)).toEqual([
      "setup",
      "adding-items",
      "listings",
      "inventory",
      "orders",
      "settings",
      "porter",
      "messages",
    ]);
  });

  it("every capture manifest's capture steps exactly match its topic's step ids", () => {
    for (const m of CAPTURE_MANIFESTS) {
      const topic = getTopic(m.topic);
      expect(topic, m.topic).toBeDefined();
      const captured = m.actions.filter((a) => a.type === "capture").map((a) => (a as { step: string }).step);
      expect(captured.sort()).toEqual(topic!.steps.map((s) => s.id).sort());
    }
  });
});
