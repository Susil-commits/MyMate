import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "crypto";

export interface RequestCorrelationContext {
  correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestCorrelationContext>();

/**
 * Runs the given function within a correlation context.
 */
export const runWithCorrelationId = <T>(correlationId: string, fn: () => T): T => {
  return asyncLocalStorage.run({ correlationId }, fn);
};

/**
 * Retrieves the current correlation ID if within a request context.
 */
export const getCorrelationId = (): string | undefined => {
  return asyncLocalStorage.getStore()?.correlationId;
};

/**
 * Generates a standard UUID v4 correlation ID.
 */
export const generateCorrelationId = (): string => {
  return crypto.randomUUID();
};
