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
  logoutAll,
} from "../controllers/authController.js";
import { passwordResetLimiter } from "../middleware/rateLimiter.js";
import { protect, authorizeUser, authorizeDriver, optionalAuth } from "../middleware/auth.js";
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
router.get("/me", optionalAuth, getMe);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordValidator, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPasswordValidator, resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", forgotPasswordValidator, resendVerification);
import { generateCsrfToken } from "../middleware/csrf.js";

router.get("/csrf-token", (req, res) => {
  const token = req.cookies?.["XSRF-TOKEN"] || generateCsrfToken();
  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
});

router.post("/logout", logout);
router.post("/logout-all", protect, logoutAll);

export default router;