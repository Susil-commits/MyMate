// @ts-nocheck
import { Router } from "express";
import { getUserProfile, updateUserProfile, changePassword } from "../controllers/userController.js";
import { protect, authorizeUser, authorizeUserOrDriver } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { changePasswordValidator } from "../utils/validators.js";

const router = Router();

router.put("/change-password", protect, authorizeUserOrDriver, changePasswordValidator, changePassword);

router.use(protect, authorizeUser);

router.get("/profile", getUserProfile);
router.put("/profile", upload.single("avatar"), updateUserProfile);

export default router;