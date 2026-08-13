# Frontend + Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the visitor-facing half of the online demo: a Vercel-hosted page where someone submits `page`/`comment` feedback, watches it move through classification, reviews it themselves in a simplified UI, and sees the resulting GitHub issue (or spam discard) — all backed by a serverless proxy that holds Camunda credentials server-side so the browser never talks to Camunda directly.

**Architecture:** Next.js (App Router) on Vercel. Three serverless API routes wrap four Camunda REST calls (create process instance, get process instance, search user tasks, search/complete via user tasks and variables endpoints); two client pages (submission form, review/status page with polling) consume those routes only, never Camunda directly. Basic rate limiting via Upstash Redis (free tier), applied per-IP on both the run-creation and task-completion routes.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, `@upstash/ratelimit` + `@upstash/redis`, Vitest + Testing Library for tests.

## Global Constraints

- Camunda basic-auth credentials (`CAMUNDA_USERNAME`/`CAMUNDA_PASSWORD`) live only in Vercel environment variables, read server-side. No API route, page, or client bundle may expose them — verify with a build-time grep in Task 11.
- Every write to Camunda (create run, complete review task) is rate-limited per IP. Reads (status polling) are not, since polling an already-created run isn't the cost/abuse vector the spec calls out.
- The four Camunda endpoints this plan calls (`POST /v2/process-instances`, `GET /v2/process-instances/{key}`, `POST /v2/user-tasks/search`, `POST /v2/variables/search`, `POST /v2/user-tasks/{key}/completion`) and their exact request/response shapes are taken from the Camunda 8.9 orchestration-cluster OpenAPI spec at `~/docs/camunda-docs/api/camunda/v2/{process-instances,user-tasks,variables}.yaml` — reread those files if anything here seems to disagree with a running Camunda 8.9 instance rather than guessing.
- Variable values returned by `/v2/variables/search` and `/v2/user-tasks/{key}/variables/search` are JSON-*encoded strings* (Zeebe's convention) — `"spam"` comes back as the four-character string `"spam"` including the quote characters, and must be `JSON.parse`d, not used as-is.
- `processDefinitionId` is always the literal string `doc-feedback-triage` (confirmed from `models/doc-feedback-triage.bpmn`'s `<bpmn:process id="doc-feedback-triage">`).
- The four valid `category` values are `bug`, `docs-gap`, `question`, `spam` — exactly what `ClassifyFeedbackWorker`'s prompt in `doc-feedback-triage-agent` asks Claude to return.
- This plan does not gate anything on the pending Camunda license — same as the infra plan, it builds a fully working link that stays unpublished until the license clears.

## Depends on

The backend infra plan (`2026-08-13-backend-infra.md`) must have completed through Task 7 before Task 11 of this plan (deployment + live verification) can run — it provides `CAMUNDA_REST_URL` (the Cloudflare Tunnel hostname) and the rotated `CAMUNDA_DEMO_PASSWORD`. Tasks 1-10 (all the actual application code and its tests) don't need a live backend — everything is tested against mocks.

---

### Task 1: Scaffold the Next.js + Vitest project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx` (placeholder, replaced in Task 9)
- Create: `frontend/.env.example`

**Interfaces:**
- Produces: a buildable, testable Next.js app skeleton with the `@/*` → `src/*` path alias — every later task's imports (`@/lib/...`) depend on this alias being wired in both `tsconfig.json` and `vitest.config.ts`.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "doc-feedback-triage-online-demo-frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@upstash/ratelimit": "^2.0.0",
    "@upstash/redis": "^1.34.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite-tsconfig-paths": "^5.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 5: `src/app/layout.tsx`**

```tsx
export const metadata = {
  title: "doc-feedback-triage: live demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: placeholder `src/app/page.tsx`** (Task 9 replaces this)

```tsx
export default function HomePage() {
  return <p>doc-feedback-triage online demo — under construction.</p>;
}
```

- [ ] **Step 7: `.env.example`**

```
CAMUNDA_REST_URL=https://camunda-api.petercimring.space
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 8: Install and verify the build**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo/frontend
npm install
npm run build
```
Expected: build succeeds, producing the placeholder page.

- [ ] **Step 9: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json \
  frontend/next.config.ts frontend/vitest.config.ts frontend/src frontend/.env.example
git commit -m "Scaffold Next.js + Vitest frontend project"
```

---

### Task 2: `lib/env.ts` — Camunda config loader

**Files:**
- Create: `frontend/src/lib/env.ts`
- Test: `frontend/src/lib/__tests__/env.test.ts`

**Interfaces:**
- Produces: `CamundaConfig` type and `getCamundaConfig(env?)` function. Task 3's `camunda.ts` and every API route in Tasks 6-8 consume both.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { getCamundaConfig } from "../env";

describe("getCamundaConfig", () => {
  it("returns the config when all three vars are present", () => {
    const config = getCamundaConfig({
      CAMUNDA_REST_URL: "https://camunda-api.example.com",
      CAMUNDA_USERNAME: "demo",
      CAMUNDA_PASSWORD: "secret",
    } as NodeJS.ProcessEnv);
    expect(config).toEqual({
      restUrl: "https://camunda-api.example.com",
      username: "demo",
      password: "secret",
    });
  });

  it("throws when CAMUNDA_PASSWORD is missing", () => {
    expect(() =>
      getCamundaConfig({
        CAMUNDA_REST_URL: "https://camunda-api.example.com",
        CAMUNDA_USERNAME: "demo",
      } as NodeJS.ProcessEnv)
    ).toThrow(/CAMUNDA_REST_URL, CAMUNDA_USERNAME, and CAMUNDA_PASSWORD/);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd ~/projects/camunda/doc-feedback-triage-online-demo/frontend && npx vitest run src/lib/__tests__/env.test.ts`
Expected: FAIL — `../env` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
export interface CamundaConfig {
  restUrl: string;
  username: string;
  password: string;
}

export function getCamundaConfig(env: NodeJS.ProcessEnv = process.env): CamundaConfig {
  const restUrl = env.CAMUNDA_REST_URL;
  const username = env.CAMUNDA_USERNAME;
  const password = env.CAMUNDA_PASSWORD;
  if (!restUrl || !username || !password) {
    throw new Error(
      "Missing Camunda config: CAMUNDA_REST_URL, CAMUNDA_USERNAME, and CAMUNDA_PASSWORD must all be set"
    );
  }
  return { restUrl, username, password };
}
```

- [ ] **Step 4: Run again, confirm it passes**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/src/lib/env.ts frontend/src/lib/__tests__/env.test.ts
git commit -m "Add Camunda config loader with validation"
```

---

### Task 3: `lib/camunda.ts` — Camunda API client

**Files:**
- Create: `frontend/src/lib/camunda.ts`
- Test: `frontend/src/lib/__tests__/camunda.test.ts`

**Interfaces:**
- Consumes: `CamundaConfig` from Task 2.
- Produces: `CamundaApiError`, `createProcessInstance`, `getProcessInstance` (+ `ProcessInstanceState` type), `searchUserTasksForProcessInstance`, `searchVariablesForProcessInstance` (+ `RawVariable` type), `completeUserTask`. Task 4 (`status.ts`) consumes `ProcessInstanceState` and `RawVariable`; Tasks 6-8 (API routes) consume every function here.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/lib/__tests__/camunda.test.ts`
Expected: FAIL — `../camunda` doesn't exist.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run src/lib/__tests__/camunda.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/src/lib/camunda.ts frontend/src/lib/__tests__/camunda.test.ts
git commit -m "Add Camunda REST API client for process instances, user tasks, variables"
```

---

### Task 4: `lib/status.ts` — derive visitor-facing run status

**Files:**
- Create: `frontend/src/lib/status.ts`
- Test: `frontend/src/lib/__tests__/status.test.ts`

**Interfaces:**
- Consumes: `ProcessInstanceState`, `RawVariable` from Task 3.
- Produces: `RunStatus` discriminated union and `deriveRunStatus(state, pendingUserTasks, rawVariables)`. Task 7's status route and Task 10's review page both consume `RunStatus`; Task 7 calls `deriveRunStatus` directly.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/lib/__tests__/status.test.ts`
Expected: FAIL — `../status` doesn't exist.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run src/lib/__tests__/status.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/src/lib/status.ts frontend/src/lib/__tests__/status.test.ts
git commit -m "Add pure function deriving visitor-facing run status from Camunda API responses"
```

---

### Task 5: `lib/ratelimit.ts` — per-IP rate limiter

**Files:**
- Create: `frontend/src/lib/ratelimit.ts`
- Test: `frontend/src/lib/__tests__/ratelimit.test.ts`

**Interfaces:**
- Produces: `RateLimiter` type and `createRateLimiter(prefix, limit, window)`. Tasks 6 and 8 each instantiate one at module scope.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const limitMock = vi.fn();
const slidingWindowMock = vi.fn().mockReturnValue("SLIDING_WINDOW_CONFIG");

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: Object.assign(
      vi.fn().mockImplementation(() => ({ limit: limitMock })),
      { slidingWindow: slidingWindowMock }
    ),
  };
});
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn().mockReturnValue("FAKE_REDIS_CLIENT") },
}));

import { createRateLimiter } from "../ratelimit";
import { Ratelimit } from "@upstash/ratelimit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRateLimiter", () => {
  it("configures a sliding window limiter with the given prefix/limit/window", () => {
    createRateLimiter("runs:create", 5, "10 m");

    expect(slidingWindowMock).toHaveBeenCalledWith(5, "10 m");
    expect(Ratelimit).toHaveBeenCalledWith({
      redis: "FAKE_REDIS_CLIENT",
      limiter: "SLIDING_WINDOW_CONFIG",
      prefix: "runs:create",
    });
  });

  it("check() returns the underlying limiter's success value", async () => {
    limitMock.mockResolvedValue({ success: false });
    const limiter = createRateLimiter("runs:create", 5, "10 m");

    const result = await limiter.check("1.2.3.4");

    expect(result).toBe(false);
    expect(limitMock).toHaveBeenCalledWith("1.2.3.4");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/lib/__tests__/ratelimit.test.ts`
Expected: FAIL — `../ratelimit` doesn't exist.

- [ ] **Step 3: Implement**

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimiter {
  check(identifier: string): Promise<boolean>;
}

export function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h"}`
): RateLimiter {
  const redis = Redis.fromEnv();
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  });
  return {
    async check(identifier: string): Promise<boolean> {
      const { success } = await ratelimit.limit(identifier);
      return success;
    },
  };
}
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run src/lib/__tests__/ratelimit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/src/lib/ratelimit.ts frontend/src/lib/__tests__/ratelimit.test.ts
git commit -m "Add per-IP sliding-window rate limiter backed by Upstash Redis"
```

---

### Task 6: `POST /api/runs` — start a run

**Files:**
- Create: `frontend/src/app/api/runs/route.ts`
- Test: `frontend/src/app/api/runs/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getCamundaConfig` (Task 2), `createProcessInstance` + `CamundaApiError` (Task 3), `createRateLimiter` (Task 5).
- Produces: `POST` handler returning `{ processInstanceKey }` on success. Task 9's landing page calls this route.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/ratelimit", () => ({ createRateLimiter: () => ({ check: checkMock }) }));
vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

const createProcessInstanceMock = vi.fn();
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/app/api/runs/__tests__/route.test.ts`
Expected: FAIL — `../route` doesn't exist.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run src/app/api/runs/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add "frontend/src/app/api/runs/route.ts" "frontend/src/app/api/runs/__tests__/route.test.ts"
git commit -m "Add POST /api/runs: rate-limited proxy to create a process instance"
```

---

### Task 7: `GET /api/runs/[processInstanceKey]` — poll status

**Files:**
- Create: `frontend/src/app/api/runs/[processInstanceKey]/route.ts`
- Test: `frontend/src/app/api/runs/[processInstanceKey]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getCamundaConfig` (Task 2), `getProcessInstance`/`searchUserTasksForProcessInstance`/`searchVariablesForProcessInstance`/`CamundaApiError` (Task 3), `deriveRunStatus` (Task 4).
- Produces: `GET` handler returning a `RunStatus` JSON body. Task 10's review page polls this route.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

const getProcessInstanceMock = vi.fn();
const searchUserTasksMock = vi.fn();
const searchVariablesMock = vi.fn();
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run "src/app/api/runs/[processInstanceKey]/__tests__/route.test.ts"`
Expected: FAIL — `../route` doesn't exist.

- [ ] **Step 3: Implement**

```ts
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
```

Route params are a `Promise` here (not a plain object) — that's Next.js 15's App Router convention for dynamic segments, not a mistake to "fix."

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run "src/app/api/runs/[processInstanceKey]/__tests__/route.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add "frontend/src/app/api/runs/[processInstanceKey]"
git commit -m "Add GET /api/runs/[processInstanceKey]: status-polling proxy"
```

---

### Task 8: `POST /api/tasks/[userTaskKey]/complete` — confirm/override review

**Files:**
- Create: `frontend/src/app/api/tasks/[userTaskKey]/complete/route.ts`
- Test: `frontend/src/app/api/tasks/[userTaskKey]/complete/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getCamundaConfig` (Task 2), `completeUserTask`/`CamundaApiError` (Task 3), `createRateLimiter` (Task 5).
- Produces: `POST` handler, 204 on success. Task 10's review page calls this route.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/ratelimit", () => ({ createRateLimiter: () => ({ check: checkMock }) }));
vi.mock("@/lib/env", () => ({ getCamundaConfig: () => ({ restUrl: "x", username: "y", password: "z" }) }));

const completeUserTaskMock = vi.fn();
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run "src/app/api/tasks/[userTaskKey]/complete/__tests__/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run "src/app/api/tasks/[userTaskKey]/complete/__tests__/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add "frontend/src/app/api/tasks/[userTaskKey]"
git commit -m "Add POST /api/tasks/[userTaskKey]/complete: rate-limited review-completion proxy"
```

---

### Task 9: Landing page — submission form

**Files:**
- Modify: `frontend/src/app/page.tsx` (replaces Task 1's placeholder)
- Test: `frontend/src/app/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/runs` (Task 6) via `fetch`, `useRouter` from `next/navigation`.
- Produces: the entry page. No later task consumes this directly (it's a leaf).

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import HomePage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HomePage", () => {
  it("submits page/comment and navigates to the review page on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ processInstanceKey: "123" }), { status: 200 }))
    );
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/page/i), { target: { value: "docs/x.md" } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: "typo here" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/review/123"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ page: "docs/x.md", comment: "typo here" }),
      })
    );
  });

  it("shows an error message and does not navigate on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Too many runs started. Try again later." }), { status: 429 }))
    );
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/page/i), { target: { value: "docs/x.md" } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: "typo here" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many runs/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: FAIL — placeholder `HomePage` has no form.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [page, setPage] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      const { processInstanceKey } = await res.json();
      router.push(`/review/${processInstanceKey}`);
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>doc-feedback-triage: live demo</h1>
      <p>
        Submit feedback on a (fictional) documentation page and watch it move through
        classification, human review, and, if approved, a real filed GitHub issue.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Page
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="docs/kubernetes/helm-values.md"
            required
          />
        </label>
        <label>
          Comment
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="The helm install command in this doc is missing the --namespace flag"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Starting..." : "Submit feedback"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add frontend/src/app/page.tsx "frontend/src/app/__tests__/page.test.tsx"
git commit -m "Add landing page: page/comment submission form"
```

---

### Task 10: Review page — status polling + confirm/override

**Files:**
- Create: `frontend/src/app/review/[processInstanceKey]/page.tsx`
- Test: `frontend/src/app/review/[processInstanceKey]/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `RunStatus` type (Task 4), `GET /api/runs/[processInstanceKey]` (Task 7), `POST /api/tasks/[userTaskKey]/complete` (Task 8), `useParams` from `next/navigation`.
- Produces: the review page. Leaf — nothing else consumes it.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ processInstanceKey: "123" }) }));

import ReviewPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ReviewPage", () => {
  it("shows a processing message, then the classification once pending_review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ stage: "processing" }))
      .mockResolvedValueOnce(
        jsonResponse({
          stage: "pending_review",
          userTaskKey: "456",
          page: "docs/x.md",
          comment: "typo here",
          category: "docs-gap",
          summary: "Missing namespace flag",
          confidence: 0.92,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewPage />);
    expect(screen.getByText(/classifying/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByText(/missing namespace flag/i)).toBeInTheDocument());
  });

  it("stops polling once a terminal stage (filed) is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        stage: "filed",
        category: "bug",
        summary: "Broken command",
        confidence: 0.85,
        issueUrl: "https://github.com/pcimring/docs-feedback-demo/issues/1",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://github.com/pcimring/docs-feedback-demo/issues/1"
    ));

    const callsAfterFirstLoad = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstLoad);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run "src/app/review/[processInstanceKey]/__tests__/page.test.tsx"`
Expected: FAIL — `../page` doesn't exist.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { RunStatus } from "@/lib/status";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STAGES = new Set(["discarded", "filed"]);

export default function ReviewPage() {
  const { processInstanceKey } = useParams<{ processInstanceKey: string }>();
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [category, setCategory] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function poll() {
      const res = await fetch(`/api/runs/${processInstanceKey}`);
      if (!res.ok || stopped) return;
      const data: RunStatus = await res.json();
      if (stopped) return;
      setStatus(data);
      if (data.stage === "pending_review") {
        setCategory((current) => current || data.category);
      }
      if (TERMINAL_STAGES.has(data.stage)) {
        clearInterval(intervalId);
      }
    }

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [processInstanceKey]);

  async function handleComplete() {
    if (status?.stage !== "pending_review") return;
    setCompleting(true);
    await fetch(`/api/tasks/${status.userTaskKey}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    setCompleting(false);
  }

  if (!status || status.stage === "processing") {
    return <p>Classifying feedback...</p>;
  }

  if (status.stage === "pending_review") {
    return (
      <main>
        <h1>Review classification</h1>
        <p>Page: {status.page}</p>
        <p>Comment: {status.comment}</p>
        <p>
          Claude classified this as <strong>{status.category}</strong> (
          {Math.round(status.confidence * 100)}% confidence): {status.summary}
        </p>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="bug">bug</option>
            <option value="docs-gap">docs-gap</option>
            <option value="question">question</option>
            <option value="spam">spam</option>
          </select>
        </label>
        <button onClick={handleComplete} disabled={completing}>
          {completing ? "Filing..." : "Confirm and file issue"}
        </button>
      </main>
    );
  }

  if (status.stage === "discarded") {
    return <p>Classified as spam and discarded automatically. No issue filed.</p>;
  }

  return (
    <p>
      Issue filed: <a href={status.issueUrl}>{status.issueUrl}</a>
    </p>
  );
}
```

- [ ] **Step 4: Run again, confirm pass**

Run: `npx vitest run "src/app/review/[processInstanceKey]/__tests__/page.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add "frontend/src/app/review"
git commit -m "Add review page: status polling and confirm/override UI"
```

---

### Task 11: Deploy to Vercel and verify against the live backend

**Manual account setup (Vercel + Upstash), then agent/human-executable commands.** Depends on the backend infra plan's Task 7 output (`CAMUNDA_REST_URL`, `CAMUNDA_DEMO_PASSWORD`).

**Files:**
- Modify: root `README.md`'s "Running the online demo" section (still stubbed from the infra plan's Task 2/8).

- [ ] **Step 1: Create a free Upstash Redis database**

In the Upstash console: create a new Redis database (any free-tier region). Copy the REST URL and REST token from its dashboard — these become `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 2: Create the Vercel project and set environment variables**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo/frontend
npx vercel link   # creates/links a Vercel project, root directory = frontend/
npx vercel env add CAMUNDA_REST_URL production
npx vercel env add CAMUNDA_USERNAME production
npx vercel env add CAMUNDA_PASSWORD production
npx vercel env add UPSTASH_REDIS_REST_URL production
npx vercel env add UPSTASH_REDIS_REST_TOKEN production
```
Values: `CAMUNDA_REST_URL` = the Cloudflare Tunnel hostname from the infra plan's Task 7 (e.g. `https://camunda-api.petercimring.space`), `CAMUNDA_USERNAME` = `demo`, `CAMUNDA_PASSWORD` = the `CAMUNDA_DEMO_PASSWORD` generated in the infra plan's Task 5.

- [ ] **Step 3: Confirm no secret leaks into the client bundle**

```bash
npm run build
grep -rl "CAMUNDA_PASSWORD\|$(cat .env.production 2>/dev/null | grep CAMUNDA_PASSWORD | cut -d= -f2)" .next/static || echo "clean: no match in client bundle"
```
Expected: "clean: no match in client bundle" — the password string itself never appears in anything shipped to the browser (only server-side route handlers reference `process.env.CAMUNDA_PASSWORD`, which Next.js never inlines into client code since it's not `NEXT_PUBLIC_`-prefixed).

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod
```
Expected: a `https://<project>.vercel.app` URL. **Do not share or link this URL anywhere yet** — same publish gate as the infra plan.

- [ ] **Step 5: End-to-end verification against the live backend**

From a browser (not curl, to exercise the real UI): open the deployed URL, submit a non-spam comment (e.g. `page: docs/kubernetes/helm-values.md`, `comment: The helm install command in this doc is missing the --namespace flag`), confirm the page navigates to `/review/<key>`, shows "Classifying feedback..." then the AI's classification within a few seconds, click "Confirm and file issue", and confirm the page updates to show a real issue link. Open that link and confirm the issue exists in `pcimring/docs-feedback-demo`. Separately, submit an obviously spammy comment and confirm the review page shows the "discarded" message without ever offering a review step.

- [ ] **Step 6: Fill in the README's "Running the online demo" section**

Replace the stub left by the infra plan's Task 2 with the live (unpublished) URL, a one-paragraph description of what happens when you use it, and the current status of the pending Camunda non-commercial license (link back to the design spec's rollout section for the full gating logic, don't restate it).

- [ ] **Step 7: Commit and push**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add README.md
git commit -m "Fill in 'running the online demo' section after successful live deployment"
git push
```
