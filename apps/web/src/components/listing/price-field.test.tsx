import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriceField } from "./price-field";

describe("PriceField", () => {
  it("shows the current price and emits the parsed number on input", () => {
    const onChange = vi.fn();
    render(<PriceField value={49.99} onChange={onChange} />);
    const input = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(input.value).toBe("49.99");
    fireEvent.change(input, { target: { value: "129.99" } });
    expect(onChange).toHaveBeenCalledWith(129.99);
  });
});
