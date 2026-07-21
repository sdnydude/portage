import { describe, it, expect } from "vitest";
import type { RecognitionCandidate } from "@portage/shared";
import {
  partitionDroppedFiles,
  groupFilesIntoItems,
  candidateToItemBody,
} from "./desktop-ingest";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("partitionDroppedFiles", () => {
  it("partitions dropped files by accepted image type", () => {
    const jpg = makeFile("a.jpg", "image/jpeg");
    const txt = makeFile("b.txt", "text/plain");

    const { accepted, rejected } = partitionDroppedFiles([jpg, txt]);

    expect(accepted).toEqual([jpg]);
    expect(rejected).toEqual([txt]);
  });
});

describe("groupFilesIntoItems", () => {
  it("separate mode makes one item group per file", () => {
    const a = makeFile("a.jpg", "image/jpeg");
    const b = makeFile("b.jpg", "image/jpeg");

    expect(groupFilesIntoItems([a, b], "separate")).toEqual([[a], [b]]);
  });

  it("single mode makes one multi-photo item group for the whole drop", () => {
    const a = makeFile("a.jpg", "image/jpeg");
    const b = makeFile("b.jpg", "image/jpeg");

    expect(groupFilesIntoItems([a, b], "single")).toEqual([[a, b]]);
  });
});

describe("candidateToItemBody", () => {
  const base: RecognitionCandidate = {
    name: "Camera",
    description: "d",
    category: "c",
    condition: "good",
    conditionNotes: "n",
    brand: "Canon",
    model: null,
    features: ["f"],
    estimatedValueLow: 10,
    estimatedValueHigh: 20,
    confidence: 0.9,
  };

  it("maps a recognition candidate + urls to a valid /items body", () => {
    const body = candidateToItemBody(base, ["u1", "u2"]);

    expect(body.title).toBe("Camera");
    expect(body.brand).toBe("Canon");
    expect(body.model).toBeUndefined();
    expect(body.estimatedValueMin).toBe(10);
    expect(body.estimatedValueMax).toBe(20);
    expect(body.photos).toEqual([
      { url: "u1", isPrimary: true },
      { url: "u2", isPrimary: false },
    ]);
  });
});
