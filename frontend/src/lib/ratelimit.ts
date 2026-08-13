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
