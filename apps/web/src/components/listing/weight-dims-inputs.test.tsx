import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeightDimsInputs } from "./weight-dims-inputs";

describe("WeightDimsInputs", () => {
  it("renders the AI-estimate hint on the light-mode-legible amber-700 shade (operator: tags unreadable in light mode, 2026-09-06)", () => {
    render(
      <WeightDimsInputs
        value={{ weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null }}
        onChange={() => {}}
        estimated
      />,
    );
    expect(screen.getByText("AI estimate · verify before publishing")).toHaveClass("text-amber-700");
  });
});
