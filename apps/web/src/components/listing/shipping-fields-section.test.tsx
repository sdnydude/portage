import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShippingFieldsSection } from "./shipping-fields-section";

describe("ShippingFieldsSection — service options", () => {
  it("offers the 2-day expedited services (probe-verified enums FedEx2Day, UPS2ndDay)", () => {
    render(
      <ShippingFieldsSection
        value={{ method: "flat", flatCost: "5", service: "", handlingDays: "" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: /fedex 2day/i })).toHaveValue("FedEx2Day");
    expect(screen.getByRole("option", { name: /ups 2nd day/i })).toHaveValue("UPS2ndDay");
  });
});
