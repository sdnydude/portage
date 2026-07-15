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

  it("renders a device-framed screenshot instead of an icon block", () => {
    render(
      <OnboardingFlow onComplete={vi.fn()} onSkip={vi.fn()} isCompleting={false} />,
    );
    expect(screen.getByRole("img", { name: "Welcome to Portage" })).toBeInTheDocument();
  });

  it("shows a secondary Explore tutorials button only on the last step", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onExplore = vi.fn();
    render(
      <OnboardingFlow
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        isCompleting={false}
        onExploreTutorials={onExplore}
      />,
    );
    expect(screen.queryByRole("button", { name: "Explore tutorials" })).not.toBeInTheDocument();
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Explore tutorials" }));
    expect(onExplore).toHaveBeenCalledOnce();
  });
});
