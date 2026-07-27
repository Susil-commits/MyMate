import express from "express";
import { generate2FA, enable2FA, verify2FALogin } from "../controllers/twoFactorController.js";
import { protect } from "../middleware/auth.js";
import { body } from "express-validator";

const router = express.Router();

router.post("/generate", protect, generate2FA);
router.post("/enable", protect, enable2FA);
router.post("/verify-login", verify2FALogin);

export default router;
