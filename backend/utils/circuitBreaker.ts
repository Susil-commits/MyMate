import CircuitBreaker from "opossum";
import logger from "../config/logger.js";

const breakerOptions = {
  timeout: 10000, // If the action takes longer than 10 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
  resetTimeout: 30000, // After 30 seconds, try again
};

export const createCircuitBreaker = (action: Function, fallback?: Function) => {
  const breaker = new CircuitBreaker(action as any, breakerOptions);

  if (fallback) {
    breaker.fallback(fallback as any);
  }

  breaker.on("open", () => logger.warn(`[CircuitBreaker] Circuit opened for ${action.name || 'action'}`));
  breaker.on("halfOpen", () => logger.info(`[CircuitBreaker] Circuit half-open for ${action.name || 'action'}`));
  breaker.on("close", () => logger.info(`[CircuitBreaker] Circuit closed for ${action.name || 'action'}`));
  breaker.on("fallback", () => logger.warn(`[CircuitBreaker] Fallback executed for ${action.name || 'action'}`));

  return breaker;
};
