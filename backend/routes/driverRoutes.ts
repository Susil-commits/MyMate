// @ts-nocheck
import { Router } from "express";
import {
  getDrivers,
  getDriverById,
  updateDriverProfile,
  getPublicStats,
  getWalletTransactions,
} from "../controllers/driverController.js";
import { protect, authorizeDriver } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = Router();

// Cache search results for 2 minutes (120 seconds), stats for 5 minutes (300 seconds)
router.get("/", cacheMiddleware("drivers", 120), getDrivers);
router.get("/stats", cacheMiddleware("stats", 300), getPublicStats);
router.get("/wallet", protect, authorizeDriver, getWalletTransactions);
router.get("/:id", getDriverById);
router.put("/profile", protect, authorizeDriver, upload.fields([
  { name: "licenseImage", maxCount: 1 },
  { name: "avatar", maxCount: 1 },
]), updateDriverProfile);

export default router;