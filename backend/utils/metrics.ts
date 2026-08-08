import client from "prom-client";
import { Express } from "express";

// Create a Registry
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: "mymate-backend",
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Define custom metrics
export const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 5, 15, 50, 100, 300, 500, 1000, 3000, 5000],
});

register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDurationMicroseconds);

export const setupMetrics = (app: Express) => {
  // Middleware to count requests and measure duration
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const route = req.route ? req.route.path : req.path;
      if (route === "/metrics" || route.startsWith("/api/docs")) return; // Don't track docs or metrics endpoints

      const duration = Date.now() - start;
      httpRequestCounter.labels(req.method, route, res.statusCode.toString()).inc();
      httpRequestDurationMicroseconds.labels(req.method, route, res.statusCode.toString()).observe(duration);
    });
    next();
  });

  // Expose the /metrics endpoint
  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
};
