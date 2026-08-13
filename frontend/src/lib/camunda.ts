import type { CamundaConfig } from "./env";

export class CamundaApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Camunda API error ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

function authHeader(config: CamundaConfig): string {
  return "Basic " + Buffer.from(`${config.username}:${config.password}`).toString("base64");
}

async function camundaFetch(config: CamundaConfig, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${config.restUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(config),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new CamundaApiError(res.status, await res.text());
  }
  return res;
}

export interface CreateRunResult {
  processInstanceKey: string;
}

export async function createProcessInstance(
  config: CamundaConfig,
  variables: { page: string; comment: string }
): Promise<CreateRunResult> {
  const res = await camundaFetch(config, "/v2/process-instances", {
    method: "POST",
    body: JSON.stringify({ processDefinitionId: "doc-feedback-triage", variables }),
  });
  const body = await res.json();
  return { processInstanceKey: body.processInstanceKey };
}

export type ProcessInstanceState = "ACTIVE" | "COMPLETED" | "TERMINATED";

export async function getProcessInstance(
  config: CamundaConfig,
  processInstanceKey: string
): Promise<{ state: ProcessInstanceState }> {
  const res = await camundaFetch(config, `/v2/process-instances/${processInstanceKey}`);
  const body = await res.json();
  return { state: body.state };
}

export async function searchUserTasksForProcessInstance(
  config: CamundaConfig,
  processInstanceKey: string
): Promise<{ userTaskKey: string }[]> {
  const res = await camundaFetch(config, "/v2/user-tasks/search", {
    method: "POST",
    body: JSON.stringify({ filter: { processInstanceKey, state: "CREATED" } }),
  });
  const body = await res.json();
  return body.items.map((item: { userTaskKey: string }) => ({ userTaskKey: item.userTaskKey }));
}

export interface RawVariable {
  name: string;
  value: string;
}

export async function searchVariablesForProcessInstance(
  config: CamundaConfig,
  processInstanceKey: string
): Promise<RawVariable[]> {
  const res = await camundaFetch(config, "/v2/variables/search", {
    method: "POST",
    body: JSON.stringify({ filter: { processInstanceKey } }),
  });
  const body = await res.json();
  return body.items.map((item: { name: string; value: string }) => ({ name: item.name, value: item.value }));
}

export async function completeUserTask(
  config: CamundaConfig,
  userTaskKey: string,
  variables: Record<string, unknown>
): Promise<void> {
  await camundaFetch(config, `/v2/user-tasks/${userTaskKey}/completion`, {
    method: "POST",
    body: JSON.stringify({ variables }),
  });
}
