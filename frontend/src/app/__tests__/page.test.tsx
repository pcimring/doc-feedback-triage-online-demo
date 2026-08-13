// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import HomePage from "../page";
import { SAMPLES } from "@/lib/samples";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HomePage", () => {
  it("submits page/comment and navigates to the review page on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ processInstanceKey: "123" }), { status: 200 }))
    );
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/page/i), { target: { value: "docs/x.md" } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: "typo here" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/review/123"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ page: "docs/x.md", comment: "typo here" }),
      })
    );
  });

  it("shows an error message and does not navigate on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Too many runs started. Try again later." }), { status: 429 }))
    );
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/page/i), { target: { value: "docs/x.md" } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: "typo here" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many runs/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("fills page/comment with one of the known samples when 'Fill in sample values' is clicked", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /fill in sample values/i }));

    const pageValue = (screen.getByLabelText(/page/i) as HTMLInputElement).value;
    const commentValue = (screen.getByLabelText(/comment/i) as HTMLTextAreaElement).value;
    expect(SAMPLES).toContainEqual({ page: pageValue, comment: commentValue });
  });
});
