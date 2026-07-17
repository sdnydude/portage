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
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "b", onSelect }),
    );
    result.current.onKeyDown(keyEvent("End"));
    expect(onSelect).toHaveBeenCalledWith("c");
    // Presses inside the debounce window accumulate — settle the burst first.
    vi.advanceTimersByTime(200);
    result.current.onKeyDown(keyEvent("Home"));
    expect(onSelect).toHaveBeenCalledWith("a");
    vi.useRealTimers();
  });

  // Arrow-hold fetch storm (fix3 F10): key repeats remount the detail pane
  // (~2 fetches per press). A burst commits once at the leading edge (single
  // presses stay instant) and once trailing when the hold settles.
  it("commits a rapid arrow burst at the leading edge and once trailing", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c", "d", "e"], selectedId: "a", onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowDown"));
    result.current.onKeyDown(keyEvent("ArrowDown"));
    result.current.onKeyDown(keyEvent("ArrowDown"));
    expect(onSelect.mock.calls).toEqual([["b"]]);
    vi.advanceTimersByTime(200);
    expect(onSelect.mock.calls).toEqual([["b"], ["d"]]);
    vi.useRealTimers();
  });

  it("ignores navigation keys typed inside a text input", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "b", onSelect }),
    );
    const input = document.createElement("input");
    const e = { key: "Home", preventDefault: vi.fn(), target: input } as unknown as React.KeyboardEvent;
    result.current.onKeyDown(e);
    expect(onSelect).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
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
