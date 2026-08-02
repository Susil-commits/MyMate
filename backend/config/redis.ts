import { Redis } from "ioredis";

// Instantiate the redis client. If REDIS_URL is not set, we can default to localhost or just null.
// Using standard local redis URI if not provided, but allowing failures to be caught gracefully.

let redis: Redis | null = null;

if (process.env.REDIS_URL || process.env.NODE_ENV !== 'test') {
  redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // stop retrying if we hit the limit or we are in a dev environment without Redis
      if (times > 2) {
        console.log("[Redis] Disabling Redis caching (connection failed).");
        return null;
      }
      return Math.min(times * 50, 2000);
    }
  });

  redis.on("error", (err) => {
    // console.warn("[Redis] Connection error:", err.message);
  });

  redis.on("connect", () => {
    console.log("[Redis] Connected successfully.");
  });
}

export default redis;
