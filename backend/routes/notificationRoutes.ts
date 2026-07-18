// @ts-nocheck
import { Router } from "express";
import { getNotifications, markAsRead, markOneAsRead } from "../controllers/notificationController.js";
import { protect, authorizeUserOrDriver } from "../middleware/auth.js";

const router = Router();

router.use(protect, authorizeUserOrDriver);

router.get("/", getNotifications);
router.put("/read-all", markAsRead);
router.put("/:id/read", markOneAsRead);

export default router;