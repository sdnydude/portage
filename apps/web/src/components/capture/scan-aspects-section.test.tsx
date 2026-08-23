import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScanAspectsSection } from "./scan-aspects-section";

function baseProps() {
  return {
    aspects: {},
    aspectValues: {},
    setAspectValue: vi.fn(),
    suggestions: {},
    confirmSuggestion: vi.fn(),
    missingRequired: [] as string[],
    isCategoryResolving: false,
    isAspectsLoading: false,
    categoryResolved: true,
  };
}

describe("ScanAspectsSection", () => {
  it("auto-expands when required aspects are missing and selects a chip via setAspectValue", () => {
    const props = baseProps();
    props.aspects = { Type: { required: true, values: ["Tube", "Solid State"] } };
    props.missingRequired = ["Type"];

    render(<ScanAspectsSection {...props} />);

    // Auto-expanded: chips are visible without clicking the header.
    const chip = screen.getByRole("button", { name: "Tube" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(props.setAspectValue).toHaveBeenCalledWith("Type", "Tube");
    expect(screen.getByText("1 required")).toBeInTheDocument();
  });

  it("tags an AI-sourced aspect with [AI]", () => {
    const props = baseProps();
    props.aspects = { Color: { required: true, values: ["Red", "Blue"] } };
    props.missingRequired = ["Color"];
    props.suggestions = { Color: ["Red"] };

    render(<ScanAspectsSection {...props} aiFilledNames={["Color"]} />);

    expect(screen.getByText("[AI]")).toBeInTheDocument();
  });

  it("renders a text input with AI suggestion chips for free-text aspects and confirms via confirmSuggestion", () => {
    const props = baseProps();
    props.aspects = { Brand: { required: true, values: null } };
    props.missingRequired = ["Brand"];
    props.suggestions = { Brand: ["Fender"] };

    render(<ScanAspectsSection {...props} />);

    const input = screen.getByPlaceholderText("Enter Brand");
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "Gibson" } });
    expect(props.setAspectValue).toHaveBeenCalledWith("Brand", "Gibson");

    fireEvent.click(screen.getByRole("button", { name: /Fender/ }));
    expect(props.confirmSuggestion).toHaveBeenCalledWith("Brand", "Fender");
  });

  it("never claims Complete when the aspect schema failed to load — shows Unavailable instead (P3 125cbc53)", () => {
    const props = { ...baseProps(), aspectsError: true };
    render(<ScanAspectsSection {...props} />);
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("collapses by default when complete, and hides optional aspects behind a disclosure", () => {
    const props = baseProps();
    props.aspects = {
      Type: { required: true, values: ["Tube"] },
      Color: { required: false, values: null },
    };
    props.aspectValues = { Type: "Tube" };

    render(<ScanAspectsSection {...props} />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
    // Collapsed by default when nothing blocks publish.
    expect(screen.queryByRole("button", { name: "Tube" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /eBay item specifics/i }));
    expect(screen.getByRole("button", { name: "Tube" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter Color")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show 1 optional detail/i }));
    expect(screen.getByPlaceholderText("Enter Color")).toBeInTheDocument();
  });

  it("shows a skeleton while resolving/loading and a listing-time note when the category is unresolved", () => {
    const props = baseProps();
    props.isCategoryResolving = true;
    const { rerender } = render(<ScanAspectsSection {...props} />);
    expect(screen.getByLabelText("Loading eBay item specifics")).toBeInTheDocument();

    rerender(
      <ScanAspectsSection {...{ ...props, isCategoryResolving: false, categoryResolved: false }} />,
    );
    expect(screen.getByText(/captured at listing time/i)).toBeInTheDocument();
  });

  it("auto-expands when required-missing appears after loading finishes (real mount order)", () => {
    const props = baseProps();
    // Mounts while the category is still resolving — collapsed, no aspects yet.
    const { rerender } = render(<ScanAspectsSection {...{ ...props, isCategoryResolving: true }} />);

    // Resolution finishes and the schema arrives with an unfilled required aspect.
    rerender(
      <ScanAspectsSection
        {...{
          ...props,
          aspects: { Type: { required: true, values: ["Tube"] } },
          missingRequired: ["Type"],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Tube" })).toBeInTheDocument();
  });

  it("falls back to a text input when the allowed-value list is too large to chip (e.g. Brand)", () => {
    const props = baseProps();
    const values = Array.from({ length: 40 }, (_, i) => `Brand ${i}`);
    props.aspects = { Brand: { required: true, values } };
    props.missingRequired = ["Brand"];

    render(<ScanAspectsSection {...props} />);

    expect(screen.getByPlaceholderText("Enter Brand")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Brand 0" })).not.toBeInTheDocument();
  });

  it("toggles a selected chip off, marks AI-suggested chips, and scrolls focused text inputs into view", () => {
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    const props = baseProps();
    props.aspects = {
      Type: { required: true, values: ["Tube", "Solid State"] },
      Notes: { required: false, values: null },
    };
    props.aspectValues = { Type: "Tube" };
    props.suggestions = { Type: ["Solid State"] };

    render(<ScanAspectsSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /eBay item specifics/i }));

    // Selected chip toggles off on second tap.
    const selected = screen.getByRole("button", { name: "Tube" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(selected);
    expect(props.setAspectValue).toHaveBeenCalledWith("Type", "");

    // AI-suggested value is visually marked.
    expect(screen.getByRole("button", { name: "✨ Solid State" })).toBeInTheDocument();

    // Focusing a free-text input scrolls it above the iOS keyboard.
    fireEvent.click(screen.getByRole("button", { name: /Show 1 optional detail/i }));
    fireEvent.focus(screen.getByPlaceholderText("Enter Notes"));
    expect(scrollSpy).toHaveBeenCalled();
  });
});
