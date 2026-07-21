import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "./drop-zone";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("DropZone", () => {
  it("calls onFiles with accepted image files on drop", () => {
    const onFiles = vi.fn();
    render(
      <DropZone onFiles={onFiles}>
        <div>zone</div>
      </DropZone>,
    );
    const jpg = makeFile("a.jpg", "image/jpeg");

    fireEvent.drop(screen.getByText("zone"), { dataTransfer: { files: [jpg] } });

    expect(onFiles).toHaveBeenCalledWith([jpg]);
  });

  it("routes non-image files to onRejected", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    render(
      <DropZone onFiles={onFiles} onRejected={onRejected}>
        <div>zone</div>
      </DropZone>,
    );
    const txt = makeFile("b.txt", "text/plain");

    fireEvent.drop(screen.getByText("zone"), { dataTransfer: { files: [txt] } });

    expect(onRejected).toHaveBeenCalledWith([txt]);
    expect(onFiles).toHaveBeenCalledWith([]);
  });

  it("marks itself active while a drag is over it and clears on leave", () => {
    render(
      <DropZone onFiles={vi.fn()}>
        <div>zone</div>
      </DropZone>,
    );
    const zone = screen.getByTestId("drop-zone");

    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-active");

    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveAttribute("data-active");
  });
});
