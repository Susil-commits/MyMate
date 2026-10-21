import { Request, Response, NextFunction } from "express";
import { generateCorrelationId, runWithCorrelationId } from "../utils/correlationContext.js";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Correlation ID Middleware
 * Extracts incoming X-Correlation-ID or X-Request-ID header, or generates a new UUID v4.
 * Attaches correlationId to req, sets X-Correlation-ID on response, and wraps
 * downstream handler in AsyncLocalStorage correlation context.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingId = (req.headers["x-correlation-id"] || req.headers["x-request-id"]) as string | undefined;
  const correlationId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  runWithCorrelationId(correlationId, () => {
    next();
  });
};
