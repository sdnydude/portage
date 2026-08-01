import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShippingConfigCard } from "./shipping-config-card";

const Pill = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button onClick={onClick}>{children}</button>
);
const tokens = { text: "#000", secondary: "#666", cardBg: "#fff", cardBorder: "#eee" };
const weightDims = { weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null };

describe("ShippingConfigCard — flat-rate cost input (beta 17be7322)", () => {
  it("shows a buyer-cost input only for flat method and reports edits", () => {
    const onShippingCostChange = vi.fn();
    const { rerender } = render(
      <ShippingConfigCard
        packageSize="small" shippingMethod="calculated" weightDims={weightDims}
        shippingCost={null} onShippingCostChange={onShippingCostChange}
        onPackageSizeChange={vi.fn()} onWeightDimsChange={vi.fn()} onShippingMethodChange={vi.fn()}
        Pill={Pill} tokens={tokens}
      />,
    );
    expect(screen.queryByLabelText(/buyer pays/i)).toBeNull();

    rerender(
      <ShippingConfigCard
        packageSize="small" shippingMethod="flat" weightDims={weightDims}
        shippingCost={null} onShippingCostChange={onShippingCostChange}
        onPackageSizeChange={vi.fn()} onWeightDimsChange={vi.fn()} onShippingMethodChange={vi.fn()}
        Pill={Pill} tokens={tokens}
      />,
    );
    fireEvent.change(screen.getByLabelText(/buyer pays/i), { target: { value: "6.50" } });
    expect(onShippingCostChange).toHaveBeenCalledWith(6.5);
  });
});
