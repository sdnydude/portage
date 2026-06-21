import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriceField } from "./price-field";

// A realistic parent that stores the parsed number, like the item editor does.
function PriceHarness({ initial }: { initial: number | null }) {
  const [v, setV] = useState<number | null>(initial);
  return <PriceField value={v} onChange={setV} />;
}

describe("PriceField", () => {
  it("shows the current price and emits the parsed number on input", () => {
    const onChange = vi.fn();
    render(<PriceField value={49.99} onChange={onChange} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(input.value).toBe("49.99");
    fireEvent.change(input, { target: { value: "129.99" } });
    expect(onChange).toHaveBeenCalledWith(129.99);
  });

  it("preserves in-progress text (e.g. a trailing decimal) instead of normalizing to the parsed number", () => {
    render(<PriceHarness initial={12} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12." } });
    expect(input.value).toBe("12."); // must NOT snap back to "12"
  });

  it("lets you clear the field and retype freely (no first-digit sticking)", () => {
    render(<PriceHarness initial={50} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "75" } });
    expect(input.value).toBe("75");
  });

  it("does not re-sync from the prop while focused (iOS caret-jump guard)", () => {
    // On iOS WebKit, re-setting a controlled input's value mid-edit bumps the
    // caret to the end — which is what blocked single-digit deletes. While the
    // field is focused the sync effect must leave the in-progress text alone.
    const { rerender } = render(<PriceField value={50} onChange={() => {}} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(input.value).toBe("50");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } }); // user deletes the first digit

    // An external prop change arrives while editing — must NOT overwrite the edit.
    rerender(<PriceField value={88} onChange={() => {}} />);
    expect(input.value).toBe("5");
  });

  it("still syncs an external prop change once the field is blurred", () => {
    const { rerender } = render(<PriceField value={50} onChange={() => {}} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    rerender(<PriceField value={88} onChange={() => {}} />);
    expect(input.value).toBe("88"); // not editing → external prefill applies
  });
});
