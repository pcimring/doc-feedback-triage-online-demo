import { NextResponse } from "next/server";
import { getCamundaConfig } from "@/lib/env";
import {
  getProcessInstance,
  searchUserTasksForProcessInstance,
  searchVariablesForProcessInstance,
  CamundaApiError,
} from "@/lib/camunda";
import { deriveRunStatus } from "@/lib/status";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ processInstanceKey: string }> }
): Promise<Response> {
  const { processInstanceKey } = await params;

  try {
    const config = getCamundaConfig();
    const [instance, tasks, variables] = await Promise.all([
      getProcessInstance(config, processInstanceKey),
      searchUserTasksForProcessInstance(config, processInstanceKey),
      searchVariablesForProcessInstance(config, processInstanceKey),
    ]);
    const status = deriveRunStatus(instance.state, tasks, variables);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof CamundaApiError && err.status === 404) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (err instanceof CamundaApiError) {
      return NextResponse.json({ error: "Failed to fetch run status" }, { status: 502 });
    }
    throw err;
  }
}
