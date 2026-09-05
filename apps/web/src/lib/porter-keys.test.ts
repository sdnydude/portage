import { describe, it, expect } from "vitest";
import type { RichMessage } from "@portage/shared";
import { messageKeys } from "./porter-keys";

describe("messageKeys", () => {
  it("gives identical repeated messages distinct, stable keys", () => {
    const a: RichMessage = { role: "user", blocks: [{ type: "text", text: "hi" }] };
    const b: RichMessage = { role: "user", blocks: [{ type: "text", text: "hi" }] };
    const keys = messageKeys([a, b]);
    expect(keys.get(a)).not.toBe(keys.get(b));
    expect(messageKeys([a, b]).get(a)).toBe(keys.get(a));
  });
});
