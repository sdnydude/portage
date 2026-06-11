import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingFlow } from "./onboarding-flow";

describe("OnboardingFlow", () => {
  it("constrains card height and allows vertical scrolling on short viewports", () => {
    render(
      <OnboardingFlow
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        isCompleting={false}
      />,
    );

    const card = screen
      .getByRole("button", { name: "Skip onboarding" })
      .closest("div.max-w-sm");
    expect(card).not.toBeNull();
    expect(card!.className).toContain("max-h-[90dvh]");
    expect(card!.className).toContain("overflow-y-auto");
  });
});
