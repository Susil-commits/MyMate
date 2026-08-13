import { Router } from "express";
import {
  recommendDrivers,
  chat,
  getHeatmap,
  verifyKyc,
  getDriverMatch,
} from "../controllers/aiController.js";
import { protect, authorizeDriver, authorizeAdmin } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = Router();

// ── Driver recommendation (Gemini + heuristic fallback) ─────────────────────
// Public — no auth required so guests on the landing page can preview
router.get(
  "/recommend",
  cacheMiddleware("ai_recommend", 300),
  recommendDrivers
);

// ── Multi-turn AI chatbot (Gemini) ───────────────────────────────────────────
// Protected — only logged-in users to prevent API abuse
router.post("/chat", protect, chat);

// ── Demand heatmap for drivers ───────────────────────────────────────────────
// Driver-only — only verified drivers need to see booking hotspots
router.get(
  "/heatmap",
  protect,
  authorizeDriver,
  cacheMiddleware("ai_heatmap", 300),
  getHeatmap
);

// ── KYC OCR verification (admin-only) ───────────────────────────────────────
// Returns OCR result + recommendation for admin to approve/reject
router.post("/verify-kyc", protect, authorizeAdmin, verifyKyc);

// ── Pure-core driver match endpoint ──────────────────────────────────────────
// Exposes the functional scoring engine (driverMatchingService) via REST
router.get(
  "/match",
  protect,
  cacheMiddleware("ai_match", 60),
  getDriverMatch
);

export default router;
