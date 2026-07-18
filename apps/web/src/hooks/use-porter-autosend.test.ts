import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePorterAutosend } from "./use-porter-autosend";

describe("usePorterAutosend", () => {
  it("sends the q param once and strips it from the URL", () => {
    const send = vi.fn();
    window.history.replaceState(null, "", "/porter?q=hello%20there");
    const { rerender } = renderHook(() => usePorterAutosend(send));
    rerender();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("hello there");
    expect(window.location.search).toBe("");
  });

  it("does nothing without a q param", () => {
    const send = vi.fn();
    window.history.replaceState(null, "", "/porter");
    renderHook(() => usePorterAutosend(send));
    expect(send).not.toHaveBeenCalled();
  });
});
