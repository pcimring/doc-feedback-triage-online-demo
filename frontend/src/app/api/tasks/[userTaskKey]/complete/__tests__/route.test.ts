import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkMock, completeUserTaskMock } = vi.hoisted(() => ({
  checkMock: vi.fn().mockResolvedValue(true),
  completeUserTaskMock: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({ createRateLimiter: () => ({ check: checkMock }) }));
vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

vi.mock("@/lib/camunda", async () => {
  const actual = await vi.importActual<typeof import("@/lib/camunda")>("@/lib/camunda");
  return { ...actual, completeUserTask: completeUserTaskMock };
});

import { POST } from "../route";
import { CamundaApiError } from "@/lib/camunda";

function request(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}
function ctx(userTaskKey: string) {
  return { params: Promise.resolve({ userTaskKey }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkMock.mockResolvedValue(true);
});

describe("POST /api/tasks/[userTaskKey]/complete", () => {
  it("400s on an invalid category", async () => {
    const res = await POST(request({ category: "not-a-real-category" }), ctx("456"));
    expect(res.status).toBe(400);
    expect(completeUserTaskMock).not.toHaveBeenCalled();
  });

  it("429s when rate-limited", async () => {
    checkMock.mockResolvedValue(false);
    const res = await POST(request({ category: "bug" }), ctx("456"));
    expect(res.status).toBe(429);
  });

  it("204s and forwards the category on success", async () => {
    completeUserTaskMock.mockResolvedValue(undefined);
    const res = await POST(request({ category: "docs-gap" }), ctx("456"));
    expect(res.status).toBe(204);
    expect(completeUserTaskMock).toHaveBeenCalledWith(
      { restUrl: "x", username: "y", password: "z" },
      "456",
      { category: "docs-gap" }
    );
  });

  it("502s when Camunda errors", async () => {
    completeUserTaskMock.mockRejectedValue(new CamundaApiError(409, "wrong state"));
    const res = await POST(request({ category: "bug" }), ctx("456"));
    expect(res.status).toBe(502);
  });
});
