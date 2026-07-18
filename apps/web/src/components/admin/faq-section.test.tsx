import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ token: "t" }) }));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args), ApiError: class extends Error {} }));

import { FaqSection } from "./faq-section";

const FAQS = [
  { id: "f1", question: "Q one?", answer: "A one.", sortOrder: 0, published: true },
  { id: "f2", question: "Q two?", answer: "A two.", sortOrder: 1, published: false },
];

beforeEach(() => apiMock.mockReset());

describe("FaqSection", () => {
  it("lists all FAQs from GET /admin/faqs with publish state visible", async () => {
    apiMock.mockResolvedValue({ faqs: FAQS });

    await act(async () => {
      render(<FaqSection />);
    });

    expect(apiMock).toHaveBeenCalledWith("/admin/faqs", expect.objectContaining({ token: "t" }));
    expect(await screen.findByText("Q one?")).toBeInTheDocument();
    expect(screen.getByText("Q two?")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument(); // unpublished badge
  });

  it("creates a FAQ via POST /admin/faqs and reloads the list", async () => {
    apiMock.mockResolvedValue({ faqs: FAQS });

    await act(async () => {
      render(<FaqSection />);
    });
    fireEvent.click(screen.getByText("+ Add FAQ"));
    fireEvent.change(screen.getByPlaceholderText("Question"), { target: { value: "New Q?" } });
    fireEvent.change(screen.getByPlaceholderText("Answer"), { target: { value: "New A." } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add FAQ"));
    });

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/admin/faqs", expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ question: "New Q?", answer: "New A." }),
      }));
    });
  });

  it("swaps ids and PUTs the new order when a FAQ moves up", async () => {
    apiMock.mockResolvedValue({ faqs: FAQS });

    await act(async () => {
      render(<FaqSection />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Move "Q two?" up'));
    });

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/admin/faqs/reorder", expect.objectContaining({
        method: "PUT",
        body: { ids: ["f2", "f1"] },
      }));
    });
  });
});
