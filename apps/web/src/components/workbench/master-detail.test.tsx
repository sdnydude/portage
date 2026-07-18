import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasterDetail } from "./master-detail";

describe("MasterDetail", () => {
  it("renders list and detail panes with the list labelled", () => {
    render(
      <MasterDetail
        list={<div>list-content</div>}
        detail={<div>detail-content</div>}
        listLabel="Inventory list"
      />,
    );
    const listPane = screen.getByRole("region", { name: "Inventory list" });
    expect(listPane).toHaveTextContent("list-content");
    expect(screen.getByText("detail-content")).toBeInTheDocument();
  });
});
