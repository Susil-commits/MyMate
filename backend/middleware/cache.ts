import NodeCache from "node-cache";

// StdTTL in seconds (default: 5 minutes)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const clearCachePrefix = (prefix: string) => {
  const keys = cache.keys();
  const toDelete = keys.filter(key => key.startsWith(prefix));
  if (toDelete.length > 0) {
    cache.del(toDelete);
  }
};

export const cacheMiddleware = (prefix: string, duration?: number) => {
  return (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }
    
    // Construct unique cache key from prefix and URL
    const key = `${prefix}_${req.originalUrl || req.url}`;
    const cachedBody = cache.get(key);

    if (cachedBody) {
      return res.status(200).json(cachedBody);
    }

    // Override res.json to capture response body
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (duration) {
          cache.set(key, body, duration);
        } else {
          cache.set(key, body);
        }
      }
      originalJson(body);
    };
    
    next();
  };
};
