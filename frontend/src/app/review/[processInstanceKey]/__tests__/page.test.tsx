// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ processInstanceKey: "123" }) }));

import ReviewPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ReviewPage", () => {
  it("shows a processing message, then the classification once pending_review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ stage: "processing" }))
      .mockResolvedValueOnce(
        jsonResponse({
          stage: "pending_review",
          userTaskKey: "456",
          page: "docs/x.md",
          comment: "typo here",
          category: "docs-gap",
          summary: "Missing namespace flag",
          confidence: 0.92,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewPage />);
    expect(screen.getByText(/classifying/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByText(/missing namespace flag/i)).toBeInTheDocument());
  });

  it("stops polling once a terminal stage (filed) is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        stage: "filed",
        category: "bug",
        summary: "Broken command",
        confidence: 0.85,
        issueUrl: "https://github.com/pcimring/docs-feedback-demo/issues/1",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewPage />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /docs-feedback-demo\/issues\/1/ })).toHaveAttribute(
        "href",
        "https://github.com/pcimring/docs-feedback-demo/issues/1"
      )
    );

    const callsAfterFirstLoad = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstLoad);
  });
});
