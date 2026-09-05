import { describe, it, expect } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import {
  CurrentItemProvider,
  useCurrentItem,
  usePublishCurrentItem,
} from "./use-current-item";

function Harness({ id }: { id: string | null }) {
  usePublishCurrentItem(id);
  const { itemId } = useCurrentItem();
  return <span data-testid="cur">{itemId ?? "none"}</span>;
}

describe("useCurrentItem", () => {
  it("defaults to null and updates when set", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CurrentItemProvider>{children}</CurrentItemProvider>
    );
    const { result } = renderHook(() => useCurrentItem(), { wrapper });

    expect(result.current.itemId).toBeNull();

    act(() => result.current.setCurrentItem("item-1"));

    expect(result.current.itemId).toBe("item-1");
  });

  it("returns a null default when used without a provider", () => {
    const { result } = renderHook(() => useCurrentItem());

    expect(result.current.itemId).toBeNull();
  });

  it("usePublishCurrentItem publishes the id on mount", () => {
    render(
      <CurrentItemProvider>
        <Harness id="item-9" />
      </CurrentItemProvider>,
    );

    expect(screen.getByTestId("cur").textContent).toBe("item-9");
  });
});
