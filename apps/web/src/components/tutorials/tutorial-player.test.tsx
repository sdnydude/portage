import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TutorialPlayer } from "./tutorial-player";
import type { TutorialTopic } from "@/lib/tutorials";

const topic: TutorialTopic = {
  slug: "demo",
  title: "Demo Topic",
  description: "d",
  steps: [
    { id: "one", title: "Step One", body: "First body", screenshot: "/tutorials/demo/one.png", overlays: [] },
    { id: "two", title: "Step Two", body: "Second body", screenshot: "/tutorials/demo/two.png", overlays: [{ type: "tap", x: 50, y: 50 }] },
  ],
};

describe("TutorialPlayer", () => {
  it("renders the first step's title, body, and screenshot", () => {
    render(<TutorialPlayer topic={topic} />);
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
    expect(screen.getByText("First body")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Step One" })).toHaveAttribute("src", "/tutorials/demo/one.png");
  });

  it("advances to the next step on Next and renders its overlays", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Step Two" })).toBeInTheDocument();
    expect(screen.getAllByTestId("tutorial-overlay")).toHaveLength(1);
  });

  it("goes back with Back, which is hidden on the first step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
  });

  it("hides Next on the last step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
