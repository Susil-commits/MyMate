import { Router } from "express";
import { recommendDrivers, chat, getHeatmap } from "../controllers/aiController.js";
import { protect, authorizeDriver } from "../middleware/auth.js";

const router = Router();

router.get("/recommend", recommendDrivers);
router.post("/chat", protect, chat);
router.get("/heatmap", protect, authorizeDriver, getHeatmap);

export default router;
