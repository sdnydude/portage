import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: h.apiMock, ApiError: class extends Error {} }));

import { ReverbCategorySection } from "./reverb-category-section";

describe("ReverbCategorySection", () => {
  it("renders two cascade levels that share a label without a duplicate-key warning", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (path.startsWith("/marketplace/reverb/subcategories")) {
        return { subcategories: [{ uuid: "c1", fullName: "Effects and Pedals > Fuzz", name: "Fuzz", rootUuid: "root-fx", listable: true }] };
      }
      return {};
    });
    render(<ReverbCategorySection value={null} onChange={vi.fn()} token="t" />);
    fireEvent.change(await screen.findByLabelText(/product type/i), { target: { value: "root-fx" } });
    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThan(1));
    const dupKey = errorSpy.mock.calls.some((c) => String(c[0]).includes("same key"));
    errorSpy.mockRestore();
    expect(dupKey).toBe(false);
  });

  it("loads the Product Type roots into the first cascade level", async () => {
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      return {};
    });
    render(<ReverbCategorySection value={null} onChange={vi.fn()} token="t" />);
    expect(await screen.findByRole("option", { name: "Effects and Pedals" })).toBeInTheDocument();
    expect((screen.getByLabelText(/product type/i) as HTMLSelectElement).value).toBe("");
  });

  it("hydrates the selects from a seeded value — the AI category shows AS the selection, not a default", async () => {
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (path === "/marketplace/reverb/subcategories?parent=root-fx") {
        return { subcategories: [{ uuid: "u-dist", fullName: "Effects and Pedals / Distortion", name: "Distortion", rootUuid: "root-fx", listable: true }] };
      }
      if (path.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      return {};
    });
    render(
      <ReverbCategorySection
        value={{ uuid: "u-dist", fullName: "Effects and Pedals / Distortion" }}
        onChange={vi.fn()} token="t"
      />,
    );
    await waitFor(() => {
      expect((screen.getByLabelText(/product type/i) as HTMLSelectElement).value).toBe("root-fx");
    });
    expect((screen.getByLabelText(/subcategory 1/i) as HTMLSelectElement).value).toBe("u-dist");
  });

  it("drills down: picking a product type reports it, loads children, and picking a child deepens the choice", async () => {
    const onChange = vi.fn();
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/marketplace/reverb/product-types") {
        return { productTypes: [{ uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true }] };
      }
      if (path === "/marketplace/reverb/subcategories?parent=root-fx") {
        return { subcategories: [
          { uuid: "u-dist", fullName: "Effects and Pedals / Distortion", name: "Distortion", rootUuid: "root-fx", listable: true },
          { uuid: "u-dead", fullName: "Effects and Pedals / Discontinued", name: "Discontinued", rootUuid: "root-fx", listable: false },
        ] };
      }
      if (path.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      return {};
    });
    render(<ReverbCategorySection value={null} onChange={onChange} token="t" />);
    await screen.findByRole("option", { name: "Effects and Pedals" });

    fireEvent.change(screen.getByLabelText(/product type/i), { target: { value: "root-fx" } });
    expect(onChange).toHaveBeenLastCalledWith({ uuid: "root-fx", fullName: "Effects and Pedals" });

    // Children load into Subcategory 1 — non-listable nodes are not offered.
    const sub1 = (await screen.findByLabelText(/subcategory 1/i)) as HTMLSelectElement;
    expect(screen.queryByRole("option", { name: "Discontinued" })).toBeNull();
    fireEvent.change(sub1, { target: { value: "u-dist" } });
    expect(onChange).toHaveBeenLastCalledWith({ uuid: "u-dist", fullName: "Effects and Pedals / Distortion" });

    // Stepping back to "(stop here)" reverts the choice to the parent.
    fireEvent.change(sub1, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ uuid: "root-fx", fullName: "Effects and Pedals" });
  });

  it("keeps a seeded non-listable node visible as the current selection (PR #280 review gap)", async () => {
    h.apiMock.mockImplementation(async (path: string) => {
      if (path === "/marketplace/reverb/product-types") {
        return {
          productTypes: [
            { uuid: "root-parts", fullName: "Parts", name: "Parts", rootUuid: "root-parts", listable: false },
            { uuid: "root-fx", fullName: "Effects and Pedals", name: "Effects and Pedals", rootUuid: "root-fx", listable: true },
          ],
        };
      }
      if (path.startsWith("/marketplace/reverb/subcategories")) return { subcategories: [] };
      return {};
    });
    render(
      <ReverbCategorySection value={{ uuid: "root-parts", fullName: "Parts" }} onChange={vi.fn()} token="t" />,
    );
    // The seeded choice must render AS the selection, not vanish into the placeholder.
    await waitFor(() => {
      expect((screen.getByLabelText(/product type/i) as HTMLSelectElement).value).toBe("root-parts");
    });
    expect(screen.getByRole("option", { name: "Parts" })).toBeInTheDocument();
  });
});
