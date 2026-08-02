import redis from "../config/redis.js";

// Helper to clear cache by prefix. 
// With Redis, we use SCAN to find keys by prefix and delete them.
export const clearCachePrefix = async (prefix: string) => {
  if (!redis || redis.status !== "ready") return;

  try {
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("[Cache] Clear error:", err);
  }
};

export const cacheMiddleware = (prefix: string, durationInSeconds: number = 300) => {
  return async (req: any, res: any, next: any) => {
    // Only cache GET requests and only if Redis is available
    if (req.method !== "GET" || !redis || redis.status !== "ready") {
      return next();
    }
    
    // Construct unique cache key from prefix and URL
    const key = `${prefix}_${req.originalUrl || req.url}`;
    
    try {
      const cachedBody = await redis.get(key);
      if (cachedBody) {
        return res.status(200).json(JSON.parse(cachedBody));
      }
    } catch (err) {
      console.error("[Cache] Read error:", err);
      return next();
    }

    // Override res.json to capture response body
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          redis?.set(key, JSON.stringify(body), "EX", durationInSeconds).catch(e => {
              console.error("[Cache] Write error:", e);
          });
        } catch (e) {
            // Ignore JSON stringify errors
        }
      }
      originalJson(body);
    };
    
    next();
  };
};
