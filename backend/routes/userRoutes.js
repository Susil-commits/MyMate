import { Router } from "express";
import { getUserProfile, updateUserProfile, changePassword } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { changePasswordValidator } from "../utils/validators.js";

const router = Router();

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, upload.single("avatar"), updateUserProfile);
router.put("/change-password", protect, changePasswordValidator, changePassword);

export default router;