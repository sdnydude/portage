import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RecognitionCandidate } from "@portage/shared";
import { IngestQueue } from "./ingest-queue";
import type { IngestItem } from "@/hooks/use-desktop-ingest";

function readyItem(id: string, name: string): IngestItem {
  return {
    id,
    files: [],
    status: "ready",
    uploadedUrls: [],
    fields: { name } as RecognitionCandidate,
  };
}

describe("IngestQueue", () => {
  it("renders an editable title per ready item", () => {
    render(
      <IngestQueue
        items={[readyItem("1", "Camera")]}
        onSave={vi.fn()}
        onRemove={vi.fn()}
        onUpdateTitle={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Camera")).toBeInTheDocument();
  });

  it("fires onSave with the item id when Save is clicked", () => {
    const onSave = vi.fn();
    render(
      <IngestQueue
        items={[readyItem("1", "Camera")]}
        onSave={onSave}
        onRemove={vi.fn()}
        onUpdateTitle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith("1");
  });
});
