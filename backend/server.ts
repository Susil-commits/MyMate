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
import authRoutes from "./routes/authRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter, authLimiter, paymentLimiter } from "./middleware/rateLimiter.js";
import { createServer } from "http";
import { initSocket } from "./utils/socket.js";
import { startCronJobs } from "./utils/cronJobs.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

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

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
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
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const httpServer = createServer(app);
  initSocket(httpServer, allowedOrigins);
  startCronJobs();

  let server;
  if (process.env.NODE_ENV !== "test") {
    server = httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    if (server) {
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
    setTimeout(() => process.exit(1), 10000);
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

export { app };