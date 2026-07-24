// @ts-nocheck
import { Router } from "express";
import {
  userRegister,
  userLogin,
  completeUserProfile,
  driverRegister,
  driverLogin,
  completeDriverProfile,
  adminLogin,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  logout,
} from "../controllers/authController.js";
import { protect, authorizeUser, authorizeDriver } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  userRegisterValidator,
  userLoginValidator,
  completeUserProfileValidator,
  driverRegisterValidator,
  driverLoginValidator,
  completeDriverProfileValidator,
  adminLoginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "../utils/validators.js";

const router = Router();

router.post("/user/register", userRegisterValidator, userRegister);
router.post("/user/login", userLoginValidator, userLogin);
router.put("/user/complete-profile", protect, authorizeUser, completeUserProfileValidator, completeUserProfile);

router.post("/driver/register", driverRegisterValidator, driverRegister);
router.post("/driver/login", driverLoginValidator, driverLogin);
router.put("/driver/complete-profile", protect, authorizeDriver, upload.single("licenseImage"), completeDriverProfileValidator, completeDriverProfile);

router.post("/admin/login", adminLoginValidator, adminLogin);
router.get("/me", protect, getMe);
router.post("/forgot-password", forgotPasswordValidator, forgotPassword);
router.post("/reset-password", resetPasswordValidator, resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", forgotPasswordValidator, resendVerification);
router.post("/logout", logout);

export default router;