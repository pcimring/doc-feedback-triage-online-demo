import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkMock } = vi.hoisted(() => {
  return {
    checkMock: vi.fn().mockResolvedValue(true),
  };
});
vi.mock("@/lib/ratelimit", () => ({ createRateLimiter: () => ({ check: checkMock }) }));
vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

const { createProcessInstanceMock } = vi.hoisted(() => {
  return {
    createProcessInstanceMock: vi.fn(),
  };
});
vi.mock("@/lib/camunda", async () => {
  const actual = await vi.importActual<typeof import("@/lib/camunda")>("@/lib/camunda");
  return { ...actual, createProcessInstance: createProcessInstanceMock };
});

import { POST } from "../route";
import { CamundaApiError } from "@/lib/camunda";

function request(body: unknown): Request {
  return new Request("http://localhost/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkMock.mockResolvedValue(true);
});

describe("POST /api/runs", () => {
  it("400s when page or comment is missing", async () => {
    const res = await POST(request({ page: "", comment: "hi" }));
    expect(res.status).toBe(400);
  });

  it("429s when the rate limiter rejects the IP", async () => {
    checkMock.mockResolvedValue(false);
    const res = await POST(request({ page: "docs/x.md", comment: "typo" }));
    expect(res.status).toBe(429);
    expect(createProcessInstanceMock).not.toHaveBeenCalled();
  });

  it("200s with the processInstanceKey on success", async () => {
    createProcessInstanceMock.mockResolvedValue({ processInstanceKey: "123" });
    const res = await POST(request({ page: "docs/x.md", comment: "typo" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ processInstanceKey: "123" });
    expect(createProcessInstanceMock).toHaveBeenCalledWith(
      { restUrl: "x", username: "y", password: "z" },
      { page: "docs/x.md", comment: "typo" }
    );
  });

  it("502s when Camunda returns an error", async () => {
    createProcessInstanceMock.mockRejectedValue(new CamundaApiError(500, "boom"));
    const res = await POST(request({ page: "docs/x.md", comment: "typo" }));
    expect(res.status).toBe(502);
  });
});
