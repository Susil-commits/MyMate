import { Router } from "express";
import { getNotifications, markAsRead, markOneAsRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, getNotifications);
router.put("/read-all", protect, markAsRead);
router.put("/:id/read", protect, markOneAsRead);

export default router;