import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("advances with the right chevron arrow and renders the next step's overlays", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("heading", { name: "Step Two" })).toBeInTheDocument();
    expect(screen.getAllByTestId("tutorial-overlay")).toHaveLength(1);
  });

  it("goes back with the left chevron, which is disabled on the first step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next step" }));
    await user.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
  });

  it("disables the right chevron on the last step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("swipes between steps on touch devices", () => {
    render(<TutorialPlayer topic={topic} />);
    const root = screen.getByRole("heading", { name: "Step One" }).closest("div.mx-auto")!;
    fireEvent.touchStart(root, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 180 }] });
    expect(screen.getByRole("heading", { name: "Step Two" })).toBeInTheDocument();
    fireEvent.touchStart(root, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 220 }] });
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
  });
});
