import { describe, it, expect } from "vitest";
import { deriveRunStatus } from "../status";
import type { RawVariable } from "../camunda";

function v(name: string, jsValue: unknown): RawVariable {
  return { name, value: JSON.stringify(jsValue) };
}

describe("deriveRunStatus", () => {
  it("is 'processing' when ACTIVE with no pending user task", () => {
    expect(deriveRunStatus("ACTIVE", [], [])).toEqual({ stage: "processing" });
  });

  it("is 'pending_review' when ACTIVE with a pending user task, carrying classification + original input", () => {
    const vars = [
      v("page", "docs/x.md"),
      v("comment", "typo here"),
      v("category", "docs-gap"),
      v("summary", "Missing namespace flag"),
      v("confidence", 0.92),
    ];
    const result = deriveRunStatus("ACTIVE", [{ userTaskKey: "456" }], vars);
    expect(result).toEqual({
      stage: "pending_review",
      userTaskKey: "456",
      page: "docs/x.md",
      comment: "typo here",
      category: "docs-gap",
      summary: "Missing namespace flag",
      confidence: 0.92,
    });
  });

  it("is 'discarded' when COMPLETED with category spam and no issueUrl", () => {
    const vars = [v("category", "spam"), v("summary", "Looks like spam"), v("confidence", 0.99)];
    const result = deriveRunStatus("COMPLETED", [], vars);
    expect(result).toEqual({ stage: "discarded", category: "spam", summary: "Looks like spam", confidence: 0.99 });
  });

  it("is 'filed' when COMPLETED with an issueUrl", () => {
    const vars = [
      v("category", "bug"),
      v("summary", "Broken command"),
      v("confidence", 0.85),
      v("issueUrl", "https://github.com/pcimring/docs-feedback-demo/issues/1"),
    ];
    const result = deriveRunStatus("COMPLETED", [], vars);
    expect(result).toEqual({
      stage: "filed",
      category: "bug",
      summary: "Broken command",
      confidence: 0.85,
      issueUrl: "https://github.com/pcimring/docs-feedback-demo/issues/1",
    });
  });
});
