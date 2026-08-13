import { NextResponse } from "next/server";
import { getCamundaConfig } from "@/lib/env";
import { createProcessInstance, CamundaApiError } from "@/lib/camunda";
import { createRateLimiter } from "@/lib/ratelimit";

const runsLimiter = createRateLimiter("runs:create", 5, "10 m");

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const allowed = await runsLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many runs started. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const page = typeof body?.page === "string" ? body.page.trim() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  if (!page || !comment || page.length > 2000 || comment.length > 2000) {
    return NextResponse.json(
      { error: "'page' and 'comment' are required and must be under 2000 characters" },
      { status: 400 }
    );
  }

  try {
    const config = getCamundaConfig();
    const result = await createProcessInstance(config, { page, comment });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof CamundaApiError) {
      return NextResponse.json({ error: "Failed to start run" }, { status: 502 });
    }
    throw err;
  }
}
