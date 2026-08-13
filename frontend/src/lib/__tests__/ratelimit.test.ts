import { describe, it, expect, vi, beforeEach } from "vitest";

const { limitMock, slidingWindowMock } = vi.hoisted(() => {
  return {
    limitMock: vi.fn(),
    slidingWindowMock: vi.fn().mockReturnValue("SLIDING_WINDOW_CONFIG"),
  };
});

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
