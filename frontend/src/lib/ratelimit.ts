import Redis from "ioredis";

export interface RateLimiter {
  check(identifier: string): Promise<boolean>;
}

function windowToSeconds(window: `${number} ${"s" | "m" | "h"}`): number {
  const [amount, unit] = window.split(" ");
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : 3600;
  return Number(amount) * multiplier;
}

let client: Redis | undefined;

function getClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("Missing Redis config: REDIS_URL must be set");
    }
    client = new Redis(url);
  }
  return client;
}

export function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h"}`
): RateLimiter {
  const windowSeconds = windowToSeconds(window);
  return {
    async check(identifier: string): Promise<boolean> {
      const redis = getClient();
      const key = `${prefix}:${identifier}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return count <= limit;
    },
  };
}
