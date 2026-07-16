import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useListNav } from "./use-list-nav";

const keyEvent = (key: string) =>
  ({ key, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent;

describe("useListNav", () => {
  it("selects the next id on ArrowDown", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "a", onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowDown"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("selects the first id on ArrowDown when nothing is selected", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b"], selectedId: null, onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowDown"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("does not re-select on ArrowUp at the first id", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b"], selectedId: "a", onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowUp"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("jumps to first and last with Home and End", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "b", onSelect }),
    );
    result.current.onKeyDown(keyEvent("End"));
    expect(onSelect).toHaveBeenCalledWith("c");
    result.current.onKeyDown(keyEvent("Home"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ignores non-navigation keys", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a"], selectedId: "a", onSelect }),
    );
    const e = keyEvent("Enter");
    result.current.onKeyDown(e);
    expect(onSelect).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
