import { NextResponse } from "next/server";
import { getCamundaConfig } from "@/lib/env";
import { completeUserTask, CamundaApiError } from "@/lib/camunda";
import { createRateLimiter } from "@/lib/ratelimit";

const ALLOWED_CATEGORIES = ["bug", "docs-gap", "question", "spam"] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

function isAllowedCategory(value: unknown): value is Category {
  return typeof value === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

const tasksLimiter = createRateLimiter("tasks:complete", 10, "10 m");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userTaskKey: string }> }
): Promise<Response> {
  const { userTaskKey } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const allowed = await tasksLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many actions. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  if (!isAllowedCategory(category)) {
    return NextResponse.json(
      { error: `'category' must be one of: ${ALLOWED_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const config = getCamundaConfig();
    await completeUserTask(config, userTaskKey, { category });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof CamundaApiError) {
      return NextResponse.json({ error: "Failed to complete review" }, { status: 502 });
    }
    throw err;
  }
}
