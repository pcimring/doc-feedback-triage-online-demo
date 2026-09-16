// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import HomePage from "../app/page";

describe("no em dashes", () => {
  it("the landing page and about modal render no em dash character", () => {
    const { container, getByRole } = render(<HomePage />);

    expect(container.textContent).not.toContain("—");

    fireEvent.click(getByRole("button", { name: /about this demo/i }));
    expect(container.textContent).not.toContain("—");
  });

  it("the repo README contains no em dash character", () => {
    const readme = readFileSync(join(__dirname, "../../../README.md"), "utf-8");

    expect(readme).not.toContain("—");
  });
});
