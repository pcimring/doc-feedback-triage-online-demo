import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProcessInstance,
  getProcessInstance,
  searchUserTasksForProcessInstance,
  searchVariablesForProcessInstance,
  completeUserTask,
  CamundaApiError,
} from "../camunda";
import type { CamundaConfig } from "../env";

const config: CamundaConfig = {
  restUrl: "https://camunda-api.example.com",
  username: "demo",
  password: "secret",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createProcessInstance", () => {
  it("POSTs to /v2/process-instances with the right body and auth header, returns the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ processInstanceKey: "123" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createProcessInstance(config, { page: "docs/x.md", comment: "typo" });

    expect(result).toEqual({ processInstanceKey: "123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://camunda-api.example.com/v2/process-instances");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      processDefinitionId: "doc-feedback-triage",
      variables: { page: "docs/x.md", comment: "typo" },
    });
    expect(init.headers.Authorization).toBe("Basic " + Buffer.from("demo:secret").toString("base64"));
  });

  it("throws CamundaApiError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })));
    await expect(createProcessInstance(config, { page: "x", comment: "y" })).rejects.toThrow(CamundaApiError);
  });
});

describe("getProcessInstance", () => {
  it("GETs /v2/process-instances/{key} and returns the state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ state: "ACTIVE" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProcessInstance(config, "123");

    expect(result).toEqual({ state: "ACTIVE" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://camunda-api.example.com/v2/process-instances/123");
  });
});

describe("searchUserTasksForProcessInstance", () => {
  it("POSTs /v2/user-tasks/search filtered by processInstanceKey and state CREATED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [{ userTaskKey: "456", name: "Review classification" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchUserTasksForProcessInstance(config, "123");

    expect(result).toEqual([{ userTaskKey: "456" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://camunda-api.example.com/v2/user-tasks/search");
    expect(JSON.parse(init.body)).toEqual({ filter: { processInstanceKey: "123", state: "CREATED" } });
  });
});

describe("searchVariablesForProcessInstance", () => {
  it("POSTs /v2/variables/search filtered by processInstanceKey", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [{ name: "category", value: '"docs-gap"' }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchVariablesForProcessInstance(config, "123");

    expect(result).toEqual([{ name: "category", value: '"docs-gap"' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://camunda-api.example.com/v2/variables/search");
    expect(JSON.parse(init.body)).toEqual({ filter: { processInstanceKey: "123" } });
  });
});

describe("completeUserTask", () => {
  it("POSTs /v2/user-tasks/{key}/completion with variables, expects 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await completeUserTask(config, "456", { category: "bug" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://camunda-api.example.com/v2/user-tasks/456/completion");
    expect(JSON.parse(init.body)).toEqual({ variables: { category: "bug" } });
  });
});
