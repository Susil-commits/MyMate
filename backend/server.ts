// @ts-nocheck
import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { morganMiddleware } from "./config/morgan.js";
import { xss } from "./middleware/xss.js";
import connectDB from "./config/db.js";
import v1Routes from "./routes/v1/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter, authLimiter, paymentLimiter } from "./middleware/rateLimiter.js";
import { createServer } from "http";
import { initSocket } from "./utils/socket.js";
import { startCronJobs } from "./utils/cronJobs.js";
import { setupSwagger } from "./config/swagger.js";
import { setupMetrics } from "./utils/metrics.js";
import { initializeChangeStreams } from "./events/changeStreams.js";
import { setupQueueBoard } from "./utils/queueBoard.js";
import { setupGraphQL } from "./graphql/schema.js";
import { startKafka, stopKafka, isKafkaConnected } from "./kafka/index.js";


const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Validate critical environment variables
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
if (process.env.NODE_ENV !== "test") {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL ERROR: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: "deny" },
}));
app.use(morganMiddleware);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(mongoSanitize());
app.use(xss);
app.use(hpp());

setupMetrics(app);
setupSwagger(app);

import mongoose from "mongoose";
import redisClient from "./config/redis.js";

app.get("/health", async (req, res) => {
  try {
    // Ping MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    if (mongoStatus !== "connected") {
      throw new Error("MongoDB disconnected");
    }

    // Ping Redis
    await redisClient.ping();

    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: "ok",
        redis: "ok",
        kafka: isKafkaConnected() ? "ok" : "disconnected_or_disabled"
      }
    });

  } catch (err: any) {
    res.status(503).json({
      status: "error",
      message: "Service Unavailable",
      error: err.message
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    name: "MyMate API",
    status: "running",
    docs: "/api",
    health: "/health",
  });
});

app.use("/uploads", express.static(path.join(_dirname, "uploads")));

app.use("/api", generalLimiter);

// v1 API Routes
app.use("/api/v1", v1Routes);

// Alias /api to v1 for backward compatibility
app.use("/api", v1Routes);

setupQueueBoard(app);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  connectDB().then(async () => {
    const httpServer = createServer(app);
    initSocket(httpServer, allowedOrigins);
    startCronJobs();
    
    // Initialize BullMQ Workers
    import("./utils/queue.js").catch(err => console.error("Failed to initialize queues", err));
    
    // Initialize MongoDB Change Streams
    initializeChangeStreams();

    // Initialize Kafka Messaging System
    startKafka().catch(err => console.error("Failed to start Kafka:", err));

    await setupGraphQL(app);

    // Add 404 and error handlers AFTER async routes are mounted
    app.use((req, res) => {
      res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
    });
    app.use(errorHandler);

    const server = httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down gracefully`);
      await stopKafka();
      let forceExitTimer: NodeJS.Timeout;
      if (server) {
        server.close(() => {
          console.log("Server closed");
          clearTimeout(forceExitTimer);
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
      forceExitTimer = setTimeout(() => process.exit(1), 10000);
    };


    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (err: any) => {
      console.error("UNHANDLED REJECTION! Shutting down...");
      console.error(err.name, err.message);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
  });
}

export { app };