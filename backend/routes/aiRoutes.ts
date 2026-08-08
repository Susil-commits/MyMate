import { Router } from "express";
import { recommendDrivers, chat, getHeatmap } from "../controllers/aiController.js";
import { protect, authorizeDriver } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = Router();

router.get("/recommend", cacheMiddleware("ai_recommend", 300), recommendDrivers);
router.post("/chat", protect, chat);
router.get("/heatmap", protect, authorizeDriver, cacheMiddleware("ai_heatmap", 300), getHeatmap);

export default router;
