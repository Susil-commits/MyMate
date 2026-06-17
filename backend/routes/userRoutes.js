import { Router } from "express";
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";
import { protect, authorizeUser } from "../middleware/auth.js";

const router = Router();

router.get("/profile", protect, authorizeUser, getUserProfile);
router.put("/profile", protect, authorizeUser, updateUserProfile);

export default router;