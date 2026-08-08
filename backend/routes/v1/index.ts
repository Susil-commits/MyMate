import { Router } from "express";
import authRoutes from "../authRoutes.js";
import driverRoutes from "../driverRoutes.js";
import bookingRoutes from "../bookingRoutes.js";
import reviewRoutes from "../reviewRoutes.js";
import paymentRoutes from "../paymentRoutes.js";
import userRoutes from "../userRoutes.js";
import favoriteRoutes from "../favoriteRoutes.js";
import messageRoutes from "../messageRoutes.js";
import adminRoutes from "../adminRoutes.js";
import notificationRoutes from "../notificationRoutes.js";
import twoFactorRoutes from "../twoFactorRoutes.js";
import walletRoutes from "../walletRoutes.js";
import promoRoutes from "../promoRoutes.js";
import aiRoutes from "../aiRoutes.js";
import { authLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

router.use("/auth", authLimiter, authRoutes);
router.use("/drivers", driverRoutes);
router.use("/bookings", bookingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/payments", paymentRoutes);
router.use("/users", userRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/messages", messageRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationRoutes);
router.use("/2fa", twoFactorRoutes);
router.use("/wallet", walletRoutes);
router.use("/promos", promoRoutes);
router.use("/ai", aiRoutes);

export default router;
