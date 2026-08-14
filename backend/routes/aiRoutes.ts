import { Router } from "express";
import {
  recommendDrivers,
  chat,
  getHeatmap,
  verifyKyc,
  getDriverMatch,
} from "../controllers/aiController.js";
import { protect, optionalAuth, authorizeDriver, authorizeAdmin } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { aiChatLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Driver recommendation (Gemini + heuristic fallback)
router.get(
  "/recommend",
  cacheMiddleware("ai_recommend", 300),
  recommendDrivers
);

// Multi-turn AI chatbot (Gemini with platform guardrails + fallback)
router.post("/chat", aiChatLimiter, optionalAuth, chat);

// Demand heatmap for drivers
router.get(
  "/heatmap",
  protect,
  authorizeDriver,
  cacheMiddleware("ai_heatmap", 300),
  getHeatmap
);

// KYC OCR verification (admin-only)
router.post("/verify-kyc", protect, authorizeAdmin, verifyKyc);

// Driver scoring and matchmaking endpoint
router.get(
  "/match",
  protect,
  cacheMiddleware("ai_match", 60),
  getDriverMatch
);

export default router;
