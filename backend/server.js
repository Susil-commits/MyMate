import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import logger from "./config/logger.js";
import { generalLimiter, authLimiter, paymentLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/authRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(mongoSanitize());
app.use(generalLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/webhooks", webhookRoutes);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentLimiter, paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, { env: process.env.NODE_ENV });
  });
});