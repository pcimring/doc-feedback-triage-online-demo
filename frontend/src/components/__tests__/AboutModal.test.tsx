// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import AboutModal from "../AboutModal";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AboutModal", () => {
  it("renders an 'About this demo' heading", () => {
    render(<AboutModal onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /about this demo/i })).toBeInTheDocument();
  });

  it("labels the two repo links as GitHub repos", () => {
    render(<AboutModal onClose={vi.fn()} />);

    expect(screen.getAllByText("GitHub repo:")).toHaveLength(2);
  });

  it("renders links to the agent repo, the demo repo, and the portfolio", () => {
    render(<AboutModal onClose={vi.fn()} />);

    expect(screen.getByRole("link", { name: /doc-feedback-triage-agent/i })).toHaveAttribute(
      "href",
      "https://github.com/pcimring/doc-feedback-triage-agent"
    );
    expect(screen.getByRole("link", { name: /doc-feedback-triage-online-demo/i })).toHaveAttribute(
      "href",
      "https://github.com/pcimring/doc-feedback-triage-online-demo"
    );
    expect(screen.getByRole("link", { name: /portfolio/i })).toHaveAttribute(
      "href",
      "https://pcimring.github.io"
    );
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);

    fireEvent.click(screen.getByTestId("about-modal-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
