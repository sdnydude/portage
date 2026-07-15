import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeviceFrame } from "./device-frame";

describe("DeviceFrame", () => {
  it("renders the screenshot and one node per overlay", () => {
    render(
      <DeviceFrame
        screenshot="/tutorials/setup/billing.png"
        overlays={[
          { type: "highlight", x: 10, y: 20, w: 50, h: 10 },
          { type: "tap", x: 50, y: 90 },
        ]}
        animationKey={0}
        alt="Billing settings"
      />,
    );
    expect(screen.getByRole("img", { name: "Billing settings" })).toHaveAttribute(
      "src",
      "/tutorials/setup/billing.png",
    );
    expect(screen.getAllByTestId("tutorial-overlay")).toHaveLength(2);
  });

  it("swaps to a placeholder frame when the screenshot fails to load", () => {
    render(
      <DeviceFrame screenshot="/tutorials/missing.png" overlays={[]} animationKey={0} alt="Missing" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Missing" }));
    expect(screen.getByTestId("device-frame-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Missing" })).not.toBeInTheDocument();
  });

  it("renders callout text", () => {
    render(
      <DeviceFrame
        screenshot="/tutorials/setup/billing.png"
        overlays={[{ type: "callout", x: 50, y: 30, text: "Your current plan" }]}
        animationKey={0}
        alt="Billing"
      />,
    );
    expect(screen.getByText("Your current plan")).toBeInTheDocument();
  });
});
