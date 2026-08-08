import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";

/**
 * Idempotency Middleware
 * Intercepts POST/PUT requests with an 'Idempotency-Key' header.
 * If the key exists in Redis, returns the cached response.
 * If not, captures the response and stores it in Redis for 24 hours.
 */
export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
    return next();
  }

  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${req.user?._id || "anon"}:${idempotencyKey}`;

  try {
    const cachedResponse = await redisClient.get(cacheKey);

    if (cachedResponse) {
      logger.info(`[Idempotency] Intercepted duplicate request for key: ${idempotencyKey}`);
      const { statusCode, body, headers } = JSON.parse(cachedResponse);
      
      res.status(statusCode);
      for (const [key, value] of Object.entries(headers || {})) {
        res.setHeader(key, value as string | string[]);
      }
      return res.send(body);
    }

    // Capture the response before it's sent
    const originalSend = res.send;
    res.send = function (body: any) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseData = {
          statusCode: res.statusCode,
          body: body,
          headers: res.getHeaders(),
        };
        
        // Store in Redis for 24 hours
        redisClient.setex(cacheKey, 60 * 60 * 24, JSON.stringify(responseData)).catch((err) => {
          logger.error(`[Idempotency] Failed to cache response: ${err.message}`);
        });
      }

      // Call the original send
      return originalSend.call(this, body);
    };

    next();
  } catch (err) {
    logger.error("[Idempotency] Error processing key", err);
    next();
  }
};
