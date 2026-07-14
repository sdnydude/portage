import { describe, it, expect } from "vitest";
import { MAX_PHOTOS_PER_ITEM } from "@portage/shared";
import { movePhoto, normalizePhotoOrder, removePhotoAt } from "./photos";

describe("MAX_PHOTOS_PER_ITEM", () => {
  it("is 24 — min of eBay (24) and Reverb (25) marketplace photo caps", () => {
    expect(MAX_PHOTOS_PER_ITEM).toBe(24);
  });
});

describe("movePhoto", () => {
  it("moves a photo from one index to another and renormalizes isPrimary", () => {
    const photos = [
      { url: "a.jpg", key: "a", isPrimary: true },
      { url: "b.jpg", key: "b", isPrimary: false },
      { url: "c.jpg", key: "c", isPrimary: false },
    ];
    const result = movePhoto(photos, 2, 0);
    expect(result.map((p) => p.url)).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
    expect(result.map((p) => p.isPrimary)).toEqual([true, false, false]);
    // input untouched
    expect(photos.map((p) => p.url)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });
});

describe("removePhotoAt", () => {
  it("removes the photo at an index and renormalizes isPrimary onto the new first photo", () => {
    const photos = [
      { url: "a.jpg", key: "a", isPrimary: true },
      { url: "b.jpg", key: "b", isPrimary: false },
    ];
    const result = removePhotoAt(photos, 0);
    expect(result.map((p) => p.url)).toEqual(["b.jpg"]);
    expect(result[0].isPrimary).toBe(true);
    expect(photos).toHaveLength(2);
  });
});

describe("normalizePhotoOrder", () => {
  it("sets isPrimary true on index 0 and false elsewhere, clearing stale flags", () => {
    const photos = [
      { url: "b.jpg", key: "b", isPrimary: false },
      { url: "a.jpg", key: "a", isPrimary: true },
      { url: "c.jpg", key: "c" },
    ];
    const result = normalizePhotoOrder(photos);
    expect(result.map((p) => p.isPrimary)).toEqual([true, false, false]);
    expect(result.map((p) => p.url)).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
  });
});
