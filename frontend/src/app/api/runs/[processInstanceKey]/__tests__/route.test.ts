import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

const { getProcessInstanceMock, searchUserTasksMock, searchVariablesMock } = vi.hoisted(() => ({
  getProcessInstanceMock: vi.fn(),
  searchUserTasksMock: vi.fn(),
  searchVariablesMock: vi.fn(),
}));

vi.mock("@/lib/camunda", async () => {
  const actual = await vi.importActual<typeof import("@/lib/camunda")>("@/lib/camunda");
  return {
    ...actual,
    getProcessInstance: getProcessInstanceMock,
    searchUserTasksForProcessInstance: searchUserTasksMock,
    searchVariablesForProcessInstance: searchVariablesMock,
  };
});

import { GET } from "../route";
import { CamundaApiError } from "@/lib/camunda";

function ctx(processInstanceKey: string) {
  return { params: Promise.resolve({ processInstanceKey }) };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/runs/[processInstanceKey]", () => {
  it("returns 'processing' while ACTIVE with no pending task", async () => {
    getProcessInstanceMock.mockResolvedValue({ state: "ACTIVE" });
    searchUserTasksMock.mockResolvedValue([]);
    searchVariablesMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost"), ctx("123"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stage: "processing" });
  });

  it("404s when Camunda reports the process instance doesn't exist", async () => {
    getProcessInstanceMock.mockRejectedValue(new CamundaApiError(404, "not found"));
    searchUserTasksMock.mockResolvedValue([]);
    searchVariablesMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost"), ctx("999"));

    expect(res.status).toBe(404);
  });

  it("502s on any other Camunda error", async () => {
    getProcessInstanceMock.mockRejectedValue(new CamundaApiError(500, "boom"));
    searchUserTasksMock.mockResolvedValue([]);
    searchVariablesMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost"), ctx("123"));

    expect(res.status).toBe(502);
  });
});
