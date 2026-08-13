import type { ProcessInstanceState, RawVariable } from "./camunda";

export type RunStatus =
  | { stage: "processing" }
  | {
      stage: "pending_review";
      userTaskKey: string;
      page: string;
      comment: string;
      category: string;
      summary: string;
      confidence: number;
    }
  | { stage: "discarded"; category: string; summary: string; confidence: number }
  | { stage: "filed"; category: string; summary: string; confidence: number; issueUrl: string };

function parseVariables(variables: RawVariable[]): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const { name, value } of variables) {
    parsed[name] = JSON.parse(value);
  }
  return parsed;
}

export function deriveRunStatus(
  state: ProcessInstanceState,
  pendingUserTasks: { userTaskKey: string }[],
  rawVariables: RawVariable[]
): RunStatus {
  if (state === "ACTIVE") {
    if (pendingUserTasks.length === 0) {
      return { stage: "processing" };
    }
    const vars = parseVariables(rawVariables);
    return {
      stage: "pending_review",
      userTaskKey: pendingUserTasks[0].userTaskKey,
      page: vars.page as string,
      comment: vars.comment as string,
      category: vars.category as string,
      summary: vars.summary as string,
      confidence: vars.confidence as number,
    };
  }

  const vars = parseVariables(rawVariables);
  if (typeof vars.issueUrl === "string") {
    return {
      stage: "filed",
      category: vars.category as string,
      summary: vars.summary as string,
      confidence: vars.confidence as number,
      issueUrl: vars.issueUrl,
    };
  }
  return {
    stage: "discarded",
    category: vars.category as string,
    summary: vars.summary as string,
    confidence: vars.confidence as number,
  };
}
