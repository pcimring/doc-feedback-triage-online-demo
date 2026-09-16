import { describe, it, expect, vi, beforeEach } from "vitest";

const { incrMock, expireMock } = vi.hoisted(() => {
  return {
    incrMock: vi.fn(),
    expireMock: vi.fn(),
  };
});

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      incr: incrMock,
      expire: expireMock,
    })),
  };
});

process.env.REDIS_URL = "redis://:password@example.com:6379";

import { createRateLimiter } from "../ratelimit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRateLimiter", () => {
  it("allows requests at or under the limit", async () => {
    incrMock.mockResolvedValue(5);
    const limiter = createRateLimiter("runs:create", 5, "10 m");

    const result = await limiter.check("1.2.3.4");

    expect(result).toBe(true);
    expect(incrMock).toHaveBeenCalledWith("runs:create:1.2.3.4");
  });

  it("rejects requests over the limit", async () => {
    incrMock.mockResolvedValue(6);
    const limiter = createRateLimiter("runs:create", 5, "10 m");

    const result = await limiter.check("1.2.3.4");

    expect(result).toBe(false);
  });

  it("sets the window expiry only on the first request in a window", async () => {
    incrMock.mockResolvedValueOnce(1);
    const limiter = createRateLimiter("runs:create", 5, "10 m");

    await limiter.check("1.2.3.4");

    expect(expireMock).toHaveBeenCalledWith("runs:create:1.2.3.4", 600);
  });

  it("does not reset expiry on subsequent requests in the same window", async () => {
    incrMock.mockResolvedValueOnce(2);
    const limiter = createRateLimiter("runs:create", 5, "10 m");

    await limiter.check("1.2.3.4");

    expect(expireMock).not.toHaveBeenCalled();
  });
});
