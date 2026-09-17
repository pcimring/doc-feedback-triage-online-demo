// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import AboutPanel from "../AboutPanel";

describe("AboutPanel", () => {
  it("labels the two repo links as GitHub repos", () => {
    render(<AboutPanel />);

    expect(screen.getAllByText("GitHub repo:")).toHaveLength(2);
  });

  it("renders links to the agent repo, the demo repo, and the portfolio", () => {
    render(<AboutPanel />);

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
});
